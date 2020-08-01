"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = __importStar(require("aws-sdk"));
class CappuccinosBase {
    constructor(env, options, logger, config, awsConfig, buidDir) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.projectConfig = config;
        this.awsConfig = awsConfig;
        this.buidDir = buidDir;
        this.dryRun = this.options.dryRun;
        this.cfn = new AWS.CloudFormation();
        this.s3 = new AWS.S3();
        this.lambda = new AWS.Lambda();
        this.apigateway = new AWS.APIGateway();
        this.logs = new AWS.CloudWatchLogs();
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
    async createStack(stackName, template) {
        const params = {
            StackName: stackName,
            TemplateBody: template,
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.createStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }
    async waitForCreate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackCreateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
    async updateStack(stackName, template) {
        try {
            const params = {
                StackName: stackName,
                TemplateBody: template,
                Capabilities: ['CAPABILITY_AUTO_EXPAND']
            };
            const result = await this.cfn.updateStack(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
            return result.StackId;
        }
        catch (err) {
            if (err.code === 'ValidationError' && err.message.match(/No updates/))
                return undefined;
            throw err;
        }
    }
    async waitForUpdate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackUpdateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
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
    async addPermissionToLambdaFunction(apiId, stageName, functionName) {
        const hasPermission = await this.hasPermission(apiId, functionName, stageName);
        if (hasPermission)
            return;
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
}
exports.CappuccinosBase = CappuccinosBase;
//# sourceMappingURL=CappuccinosBase.js.map