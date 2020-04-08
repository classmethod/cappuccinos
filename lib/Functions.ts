import { readFileSync } from 'fs';
import * as AWS from 'aws-sdk';
import { Process } from './Process';
import { ProjectConfig, LambdaConfig } from './types';
import { Archiver } from './Archiver';
import * as utils from './utils';
import { blue } from 'colorette';

export class Functions {

    env: string;
    options: any;
    logger: any;
    buidDir: string;
    projectConfig: ProjectConfig;
    dryRun: boolean;
    lambda: AWS.Lambda;
    layerArns: { [key: string]: string } = {};

    constructor(env: string, options: any, logger: any, config: ProjectConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/functions';
        this.projectConfig = config;
        this.dryRun = this.options.dryRun;
        this.lambda = new AWS.Lambda();
    }

    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }

    async buildAll() {
        await this.prepareBuild();
        const functions = await utils.listFunctions(this.projectConfig.functions.paths);
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
        const functions = await utils.listFunctions(this.projectConfig.functions.paths);
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
        const config = this.projectConfig.functions.configuration;
        const meregeExtConfig = async (path: string) => {
            const extConfig = await utils.loadYaml(path);
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
        config.layers = config.layers.map(layerName => this.layerArns[layerName]);
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
        const payload = JSON.parse(readFileSync(`./functions/${func}/event.${eventName}.json`, 'utf8'))
        Object.keys(extraVars).forEach(key => {
            if (key.indexOf('.') == -1) {
                payload[key] = extraVars[key];
            } else {
                const keys = key.split('.');
                payload[keys[0]][keys[1]] = extraVars[key];
            }
        });
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

}
