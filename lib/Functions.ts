import { readFileSync } from 'fs';
import * as AWS from 'aws-sdk';
import { Process } from './Process';
import { ProjectConfig, LambdaConfig, AwsConfig, LambdaPermission } from './types';
import { Archiver } from './Archiver';
import * as utils from './utils';
import { blue } from 'colorette';
import { CappuccinosBase } from './CappuccinosBase'

export class Functions extends CappuccinosBase {

    protected layerArns: { [key: string]: string } = {};

    constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
        super(env, options, logger, config, awsConfig, './build/functions');        
    }

    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }

    async list() {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        this.logger.info(`${blue('Function names:')}`);
        functions.map(functionPath => {
            const functionName = utils.toFunctionName(functionPath);
            this.logger.info(`  ${functionName}`);
        });
    }

    async deleteAll() {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(
            functions.map(functionPath => this.delete(functionPath))
        );
    }
    
    async delete(functionPath: string) {
        this.logger.debug(`> delete: ${functionPath}`);
        const functionName = utils.toFunctionName(functionPath);
        const params: AWS.Lambda.DeleteFunctionRequest = {
            FunctionName: functionName,
        };
        const resp = await this.lambda.deleteFunction(params).promise().catch(e => {});
        this.logger.debug('delete:', JSON.stringify(resp, null, 2));
        this.logger.info(`  # Delete function     ${blue('function=')}${functionName}`);
    }

    async buildAll() {
        await this.prepareBuild();
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(
            functions.map(functionPath => this.build(functionPath))
        );
    }

    async buildFunction(functionPath: string) {
        await this.prepareBuild();
        await this.build(functionPath);
    }

    async build(functionPath: string) {
        this.logger.debug(`> build: ${functionPath}`);
        const path = `./functions/${functionPath}`;
        const functionName = utils.toFunctionName(functionPath);
        const conf = this.projectConfig.functions;
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? conf.rebuild : conf.build;
        new Process(this.logger).execCommand(cmd, opts);
        const archiver = new Archiver(this.logger);
        archiver.append(`./functions/${functionPath}`, conf.files);
        for (let i = 0, len = this.projectConfig.shared.length; i < len; i++) {
            const shared = this.projectConfig.shared[i];
            archiver.append(`./shared/${shared.name}`, shared.files);
        }
        const out = `${this.buidDir}/${functionName}-${this.env}.zip`;
        await archiver.zip(out);
        this.logger.info(`  # Build function     ${blue('function=')}${functionName}`);
        return out;
    }

    async prepareBuild() {
        await this.buildSharedAll();
    }

    async buildSharedAll() {
        await Promise.all(
            this.projectConfig.shared.map(config => this.buildShared(config.name))
        );
    }

    async buildShared(name: string) {
        this.logger.debug(`> build shared: ${name}`);
        const path = `./shared/${name}`;
        const config = this.projectConfig.shared.find(s => s.name === name);
        if (config === undefined) throw new Error(`Cant find layer's config`);
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? config.rebuild : config.build;
        new Process(this.logger).execCommand(cmd, opts);
    }
 
    async deployAll() {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all([
            this.prepareBuild(),
            this.prepareDeploy()
        ]);
        await Promise.all(
            functions.map(func => this.deploy(func))
        );
    }

    async deployFunction(func: string) {
        await Promise.all([
            this.prepareBuild(),
            this.prepareDeploy()
        ]);
        await this.deploy(func);
    }

    async deploy(func: string) {
        const codePath = await this.build(func);
        const config = await this.getConfiguration(func);
        this.logger.debug(JSON.stringify(config, null, 2));
        const functionName = func.split('/').join('_');
        const currentFunction = await this.getFunction(functionName);
        this.logger.debug(JSON.stringify(currentFunction, null, 2));
        if (currentFunction === undefined) {
            await this.createFunction(functionName, config, codePath);
            this.logger.info(`  # Function created     ${blue('function=')}${functionName}`);
        } else {
            await this.updateFunctionCode(functionName, codePath);
            await this.updateFunctionConfiguration(functionName, config);
            this.logger.info(`  # Function updated     ${blue('function=')}${functionName}`);
        }
        await this.addPermissions(functionName);
    }

    async prepareDeploy() {
        await Promise.all(
            this.projectConfig.layers.map(async (layer) => {
                const layers = await this.lambda.listLayerVersions({
                    LayerName: layer.name
                }).promise();
                if (layers.LayerVersions?.length === 0) return;
                let latestVersion: number = 0;
                layers.LayerVersions?.map(lv => {
                    if (lv.Version && latestVersion < lv.Version && lv.LayerVersionArn) {
                        latestVersion = lv.Version;
                        this.layerArns[layer.name] = lv.LayerVersionArn;
                    }
                });
            })
        );
        this.logger.debug(JSON.stringify(this.layerArns, null, 2));
    }       

    async getConfiguration(func: string): Promise<LambdaConfig> {
        const config = utils.copyConfig(this.projectConfig.functions.configuration);
        const meregeExtConfig = async (path: string) => {
            const extConfig = utils.loadYaml(path);
            if (!extConfig) return;
            Object.keys(extConfig).map(key => {
                switch (key) {
                    case 'environment':
                        Object.keys(extConfig[key]).map(envKey => {
                            config.environment[envKey] = extConfig[key][envKey];
                        });                            
                        break;
                    case 'layers':
                        config.layers = config.layers.concat(extConfig.layers);
                        break;
                    default:
                        (config as any)[key] = extConfig[key];
                        break;
                }
            });
        };
        await meregeExtConfig(`./functions/${func}/function.yaml`);
        await meregeExtConfig(`./functions/${func}/function.${this.env}.yaml`);
        config.layers = config.layers.map(layerName => this.layerArns[layerName] || layerName);
        return config;
    }

    async getFunction(functionName: string) {
        try {
            const params = {
                FunctionName: functionName
            };
            const ret = await this.lambda.getFunction(params).promise();
            return ret.Configuration;
        } catch (err) {
            if (err.code == 'ResourceNotFoundException') return undefined;
            throw err;
        }
    }

    async createFunction(functionName: string, config: LambdaConfig, codePath: string) {
        const params = {
            FunctionName: functionName,
            Description: config.description,
            Runtime: config.runtime,
            MemorySize: config.memory,
            Timeout: config.timeout,
            Handler: config.handler,
            Role: config.role,
            Environment: {
                Variables: config.environment
            },
            Layers: config.layers,
            Publish: false,
            Code: {
                ZipFile: readFileSync(codePath)
            }
        };
        const resp = await this.lambda.createFunction(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
    }
    
    async updateFunctionCode(functionName: string, codePath: string) {
        const data = readFileSync(codePath);
        const params = {
            FunctionName: functionName,
            Publish: false,
            ZipFile: data
        };
        const resp = await this.lambda.updateFunctionCode(params).promise();
        this.logger.debug('upload:', JSON.stringify(resp, null, 2));
        return true;
    }

    async updateFunctionConfiguration(functionName: string, config: LambdaConfig) {
        const params = {
            FunctionName: functionName,
            Description: config.description,
            Runtime: config.runtime,
            MemorySize: config.memory,
            Timeout: config.timeout,
            Handler: config.handler,
            Role: config.role,
            Environment: {
                Variables: config.environment
            },
            Layers: config.layers
        };
        const resp = await this.lambda.updateFunctionConfiguration(params).promise();
        this.logger.debug('updateFunctionConfiguration:', JSON.stringify(resp, null, 2));
    }

    async invokeFunction(func: string, extraVars: { [key: string]: any } = {}, eventName = 'test') {
        const functionName = utils.toFunctionName(func);
        const payload = JSON.parse(readFileSync(`./functions/${func}/event.${eventName}.json`, 'utf8'));
        utils.mergeExtraVars(payload, extraVars);
        const alias = this.options.alias || '$LATEST';
        this.logger.info('>>>');
        this.logger.info(payload);
        const params: AWS.Lambda.Types.InvocationRequest = {
            FunctionName: `${functionName}:${alias}`,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        };
        if (this.options.tail) params.LogType = 'Tail';
        const ret = await this.lambda.invoke(params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
        const result = utils.payloadToObject(ret.Payload);
        this.logger.info('<<<');
        this.logger.info(result);
        if (this.options.tail) {
            this.logger.info();
            this.logger.info('Tail:');
            if (ret.LogResult) this.logger.info(Buffer.from(ret.LogResult, 'base64').toString());
        }
        return result;
    }

    async publishAll(alias: string) {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        for (let i = 0, len = functions.length; i < len; i++ ) {
            await this.publish(functions[i], alias);
            await utils.sleep(500);
        }
        this.logger.info();
    }

    async publish(func: string, alias: string) {
        const functionName = utils.toFunctionName(func);
        const version = await this.publishVersion(functionName);
        const aliasVersion = await this.getAlias(functionName, alias);
        this.logger.debug(aliasVersion);
        if (aliasVersion === undefined) {
            await this.createAlias(functionName, version, alias);
        } else if (version !== aliasVersion) {
            await this.updateAlias(functionName, version, alias);
        } else {
            this.logger.info(`  # Alias unchanged      ${blue('function=')}${functionName}, ${blue('version=')}${version}, ${blue('alias=')}${alias}`);
        }
        await this.addPermissions(functionName, alias);
    } 
    
    async publishVersion(functionName: string) {
        const params = {
            FunctionName: functionName
        };
        const resp = await this.lambda.publishVersion(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
        if (resp.Version === undefined) throw new Error('Unkown Version.');
        this.logger.info(`  # Function published   ${blue('function=')}${functionName}, ${blue('version=')}${resp.Version}`);
        return resp.Version;
    }

    async getAlias(functionName: string, alias: string) {
        try {
            const params = {
                FunctionName: functionName,
                Name: alias
            };
            const resp = await this.lambda.getAlias(params).promise();
            this.logger.debug(JSON.stringify(resp, null, 2));
            return resp.FunctionVersion;
        } catch (err) {
            if (err.code == 'ResourceNotFoundException') return undefined;
            throw err;
        }
    }

    async createAlias(functionName: string, version: string, alias: string) {
        const params = {
            FunctionName: functionName,
            FunctionVersion: version,
            Name: alias
        };
        const resp = await this.lambda.createAlias(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
        this.logger.info(`  # Alias changed       ${blue('function=')}${functionName}, ${blue('version=')}${version}, ${blue('alias=')}${alias}`);
        return resp.FunctionVersion;
    }

    async updateAlias(functionName: string, version: string, alias: string) {
        const params = {
            FunctionName: functionName,
            FunctionVersion: version,
            Name: alias
        };
        const resp = await this.lambda.updateAlias(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
        this.logger.info(`  # Alias changed       ${blue('function=')}${functionName}, ${blue('version=')}${version}, ${blue('alias=')}${alias}`);
        return resp.FunctionVersion;
    }

    private async addPermissions(functionName: string, alias?: string) {
        const func = utils.toFunctionPath(functionName);
        const config = await this.getConfiguration(func);
        if (!config.permissions || config.permissions.length === 0) return;
        const policies = await this.getPolicies(functionName, alias);
        for (let i = 0, len = config.permissions.length; i < len; i++) {
            const permission = config.permissions[i];
            const policy = policies[permission.statement_id];
            if (policy === undefined) {
                await this.addPermission(functionName, permission, alias);
            } else {
                await this.updatePermission(functionName, permission, policy, alias);
                delete policies[permission.statement_id];
            }
        }
        Object.keys(policies).map(sid => this.removePermission(functionName, sid, alias))
    }

    private async getPolicies(functionName: string, alias?: string) {
        const params: AWS.Lambda.Types.GetPolicyRequest = {
            FunctionName: functionName
        };
        if (alias) params.Qualifier = alias;
        try {
            const policies: any = {};
            const result = await this.lambda.getPolicy(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
            if (!result.Policy) return policies;
            const policy = JSON.parse(result.Policy);
            this.logger.debug(JSON.stringify(policy, null, 2));
            const statement = policy.Statement as any[];
            statement.map(st => {
                policies[st.Sid] = st;
            });
            return policies;
        } catch (err) {
            if (err.code == 'ResourceNotFoundException') return {};
            throw err;
        }
    }

    private async addPermission(functionName: string, permission: LambdaPermission, alias?: string) {
        const params: AWS.Lambda.Types.AddPermissionRequest = {
            FunctionName: functionName,
            Action: permission.action,
            Principal: permission.principal,
            StatementId: permission.statement_id,
            SourceAccount: permission.source_account,
            SourceArn: permission.source_arn
        };
        if (alias) params.Qualifier = alias;
        try {
            const result = await this.lambda.addPermission(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
        } catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                throw new Error(err.message);
            }
            throw err;
        }
    }

    private async updatePermission(functionName: string, permission: LambdaPermission, policy: any, alias?: string) {
        if (this.isNeedUpdate(permission, policy) === false) return;
        await this.removePermission(functionName, permission.statement_id, alias);
        await this.addPermission(functionName, permission, alias);
    }

    private isNeedUpdate(permission: LambdaPermission, policy: any): boolean {
        if (policy.Principal.Service !== permission.principal) return true;
        if (policy.Action !== permission.action) return true;
        if (policy.Condition && policy.Condition.StringEquals && policy.Condition.StringEquals['AWS:SourceAccount'] !== permission.source_account) return true;
        if (policy.Condition && policy.Condition.ArnLike && policy.Condition.ArnLike['AWS:SourceArn'] !== permission.source_arn) return true;
        return false;
    }

    private async removePermission(functionName: string, statementId: string, alias?: string) {
        const params: AWS.Lambda.Types.RemovePermissionRequest = {
            FunctionName: functionName,
            StatementId: statementId
        };
        if (alias) params.Qualifier = alias;
        const result = await this.lambda.removePermission(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
    }


}
