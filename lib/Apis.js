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
class Apis {
    constructor(env, options, logger, config, awsConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/apis';
        this.projectConfig = config;
        this.awsConfig = awsConfig;
        this.dryRun = this.options.dryRun;
        this.cfn = new AWS.CloudFormation();
        this.s3 = new AWS.S3();
        this.lambda = new AWS.Lambda();
        this.apigateway = new AWS.APIGateway();
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
            await this.createStack(stackName);
            this.logger.info(`  # API create start          ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForCreate(stackName);
            this.logger.info(`  # API created               ${colorette_1.blue('stackName=')}${stackName}`);
        }
        else {
            await this.updateStack(stackName);
            this.logger.info(`  # API update start          ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForUpdate(stackName);
            this.logger.info(`  # API updated               ${colorette_1.blue('stackName=')}${stackName}`);
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
    async describeStack(stackName) {
        try {
            const params = {
                StackName: stackName
            };
            const ret = await this.cfn.describeStacks(params).promise();
            this.logger.debug(JSON.stringify(ret, null, 2));
            return ret.Stacks ? ret.Stacks[0] : undefined;
        }
        catch (err) {
            if (err.code == 'ValidationError')
                return undefined;
            throw err;
        }
    }
    async createStack(stackName) {
        const params = {
            StackName: stackName,
            TemplateBody: this.makeApiTemplateBody(),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.createStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }
    async updateStack(stackName) {
        const params = {
            StackName: stackName,
            TemplateBody: this.makeApiTemplateBody(),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.updateStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
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
    async waitForCreate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackCreateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
    async waitForUpdate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackUpdateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
    async deployApiStages(stageName) {
        await Promise.all(this.projectConfig.apis.map(apiName => this.deployApiStage(apiName, stageName)));
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
    async addPermissionToLambdaFunction(apiId, stageName, functionName) {
        const hasPermission = await this.hasPermission(apiId, functionName, stageName);
        if (hasPermission)
            return;
        await this.addPermission(apiId, functionName, stageName);
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
    async hasPermission(apiId, functionName, stageName) {
        const params = {
            FunctionName: functionName,
            Qualifier: stageName
        };
        try {
            const result = await this.lambda.getPolicy(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
            if (!result.Policy)
                return false;
            const policy = JSON.parse(result.Policy);
            this.logger.debug(JSON.stringify(policy, null, 2));
            return policy.Statement.find((st) => st.Sid == `${apiId}_${stageName}`);
        }
        catch (err) {
            if (err.code == 'ResourceNotFoundException')
                return false;
            throw err;
        }
    }
    async addPermission(apiId, functionName, stageName) {
        const params = {
            FunctionName: functionName,
            Qualifier: stageName,
            Action: 'lambda:InvokeFunction',
            Principal: 'apigateway.amazonaws.com',
            StatementId: `${apiId}_${stageName}`,
            SourceArn: `arn:aws:execute-api:${this.awsConfig.region}:${this.awsConfig.account_id}:${apiId}/**`
        };
        try {
            const result = await this.lambda.addPermission(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
        }
        catch (err) {
            if (err.code === 'ResourceNotFoundException') {
                throw new Error(err.message);
            }
            throw err;
        }
    }
    getStackName() {
        return `${this.projectConfig.name}-api`;
    }
}
exports.Apis = Apis;
//# sourceMappingURL=Apis.js.map