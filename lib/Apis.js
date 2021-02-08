"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const AWS = __importStar(require("aws-sdk"));
const YAML = __importStar(require("yaml"));
const glob_1 = require("glob");
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
const CappuccinosBase_1 = require("./CappuccinosBase");
class Apis extends CappuccinosBase_1.CappuccinosBase {
    constructor(env, options, logger, config, awsConfig) {
        super(env, options, logger, config, awsConfig, './build/apis');
    }
    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }
    async makeDocumentAll() {
        await Promise.all(this.projectConfig.apis.map(apiName => this.makeDocument(apiName)));
    }
    async makeDocument(apiName) {
        const yaml = await this.mergeSwaggerFile(apiName);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        fs_1.writeFileSync(path, YAML.stringify(yaml));
        this.logger.debug(yaml);
        this.logger.debug(`spectacle -t ${this.buidDir}/${apiName} ${path}`);
        const out = child_process_1.execSync(`spectacle -t ${this.buidDir}/${apiName} ${path}`);
        this.logger.debug(out.toString());
        this.logger.info(`  # API document created        ${colorette_1.blue('api=')}${apiName}`);
    }
    async mergeSwaggerFile(apiName) {
        const swg = utils.loadYaml(`apis/${apiName}/swagger.yaml`);
        if (swg.paths === undefined)
            swg.paths = {};
        glob_1.sync(`functions/${apiName}/**/api.yaml`).map(path => {
            const paths = utils.loadYaml(path);
            Object.keys(paths).map(key => {
                if (swg.paths[key] === undefined)
                    swg.paths[key] = {};
                Object.keys(paths[key]).map(method => {
                    swg.paths[key][method] = paths[key][method];
                });
            });
        });
        if (swg.definitions === undefined)
            swg.definitions = {};
        glob_1.sync(`apis/${apiName}/definitions/*.yaml`).map(path => {
            const definitions = utils.loadYaml(path);
            Object.keys(definitions).map(key => {
                swg.definitions[key] = definitions[key];
            });
        });
        return swg;
    }
    async deploy() {
        await this.uploadSwaggerFiles();
        const stackName = this.getStackName();
        this.logger.debug(stackName);
        const stack = await this.describeStack(stackName);
        if (stack === undefined) {
            await this.createStack(stackName, this.makeApiTemplateBody());
            this.logger.info(`  # API create start          ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForCreate(stackName);
            this.logger.info(`  # API created               ${colorette_1.blue('stackName=')}${stackName}`);
        }
        else {
            const stackId = await this.updateStack(stackName, this.makeApiTemplateBody());
            if (stackId) {
                this.logger.info(`  # API update start          ${colorette_1.blue('stackName=')}${stackName}`);
                await this.waitForUpdate(stackName);
                this.logger.info(`  # API updated               ${colorette_1.blue('stackName=')}${stackName}`);
            }
            else {
                this.logger.info(`  # API No updates            ${colorette_1.blue('stackName=')}${stackName}`);
            }
        }
    }
    async uploadSwaggerFiles() {
        await Promise.all(this.projectConfig.apis.map(apiName => this.uploadSwaggerFile(apiName)));
    }
    async uploadSwaggerFile(apiName) {
        const yaml = await this.mergeSwaggerFile(apiName);
        utils.removeExamples(yaml);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        this.logger.debug(yaml);
        const accountId = this.awsConfig.account_id;
        const region = AWS.config.region;
        if (!region)
            throw new Error();
        let swagger = YAML.stringify(yaml);
        swagger = swagger.replace(/\$\{AWS::AccountId\}/g, accountId);
        swagger = swagger.replace(/\$\{AWS::Region\}/g, region);
        this.logger.debug(`upload: ${path} => templates-${region}-${accountId}/apis/${apiName}.swagger.yaml`);
        const params = {
            Bucket: `templates-${region}-${accountId}`,
            Key: `apis/${apiName}.swagger.yaml`,
            Body: swagger
        };
        await this.s3.putObject(params).promise();
        this.logger.info(`  # Uploaded   ${colorette_1.green(`s3://${params.Bucket}/${params.Key}`)}`);
    }
    makeApiTemplateBody() {
        const resouces = {};
        this.projectConfig.apis.map(apiName => {
            resouces[apiName] = {
                Type: 'AWS::ApiGateway::RestApi',
                Properties: {
                    Body: {
                        'Fn::Transform': {
                            Name: 'AWS::Include',
                            Parameters: {
                                Location: `s3://templates-${this.awsConfig.region}-${this.awsConfig.account_id}/apis/${apiName}.swagger.yaml`
                            }
                        }
                    }
                }
            };
        });
        const body = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: `${this.projectConfig.name} API`,
            Resources: resouces
        };
        this.logger.debug(YAML.stringify(body));
        return YAML.stringify(body);
    }
    async deployApiStages(stageName) {
        for (let i = 0, len = this.projectConfig.apis.length; i < len; i++) {
            const apiName = this.projectConfig.apis[i];
            await this.deployApiStage(apiName, stageName);
            await utils.sleep(500);
        }
    }
    async deployApiStage(apiName, stageName) {
        const apiId = await this.getApiId(apiName);
        const deploymentId = await this.createDeployment(apiId, stageName);
        this.logger.debug(deploymentId);
        await this.addPermissionToLambdaFunctions(apiId, stageName);
        this.logger.info(`  # Stage deployed    ${colorette_1.blue('api=')}${apiName}, ${colorette_1.blue('stage=')}${stageName}`);
    }
    async getApiId(apiName) {
        var _a;
        const stackName = this.getStackName();
        const params = {
            StackName: stackName,
            LogicalResourceId: apiName
        };
        const result = await this.cfn.describeStackResource(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        const apiId = (_a = result.StackResourceDetail) === null || _a === void 0 ? void 0 : _a.PhysicalResourceId;
        if (apiId === undefined)
            throw new Error(`apiId is unknown: ${apiName}`);
        return apiId;
    }
    async createDeployment(apiId, stageName) {
        const params = {
            restApiId: apiId,
            stageName: stageName,
            variables: {
                version: stageName
            }
        };
        const result = await this.apigateway.createDeployment(params).promise();
        const id = result.id;
        if (id === undefined)
            throw new Error(`deployment id is unknown: ${apiId}`);
        return id;
    }
    async addPermissionToLambdaFunctions(apiId, stageName) {
        const functions = await this.getIntegrationFunctions(apiId);
        await Promise.all(functions.map(functionName => this.addPermissionToLambdaFunction(apiId, stageName, functionName)));
    }
    async getIntegrationFunctions(apiId) {
        const resources = await this.getResources(apiId);
        const paramsList = resources
            .map(r => {
            if (r.id === undefined)
                throw new Error('resouce id is undefined.');
            const resourceId = r.id;
            return Object.keys(r.resourceMethods || []).map(m => ({
                restApiId: apiId,
                resourceId,
                httpMethod: m
            }));
        })
            .flat();
        const result = await Promise.all(paramsList.map(params => this.apigateway.getIntegration(params).promise()));
        const functions = result
            .map(i => {
            if (i.uri === undefined)
                return undefined;
            const m = i.uri.match(/\:function\:([a-z0-9_]+)[\:\/]/);
            return m ? m[1] : undefined;
        })
            .filter(utils.notUndefined)
            .filter((x, i, self) => self.indexOf(x) === i); // unique;
        this.logger.debug(JSON.stringify(functions, null, 2));
        return functions;
    }
    async getResources(apiId) {
        const params = {
            restApiId: apiId
        };
        const result = await this.apigateway.getResources(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.items || [];
    }
    getStackName() {
        return `${this.projectConfig.name}-api`;
    }
}
exports.Apis = Apis;
//# sourceMappingURL=Apis.js.map