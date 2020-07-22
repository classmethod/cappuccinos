import * as AWS from 'aws-sdk';
import { ProjectConfig, AwsConfig } from './types';

export class CappuccinosBase {

  protected env: string;
  protected options: any;
  protected logger: any;
  protected projectConfig: ProjectConfig;
  protected awsConfig: AwsConfig;
  protected dryRun: boolean;
  protected s3: AWS.S3;
  protected cfn: AWS.CloudFormation;
  protected lambda: AWS.Lambda;
  protected apigateway: AWS.APIGateway;
  protected buidDir: string;


  constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig, buidDir: string) {
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
  }

  async describeStack(stackName: string) {
    try {
      const params = {
        StackName: stackName
      };
      const ret = await this.cfn.describeStacks(params).promise();
      this.logger.debug(JSON.stringify(ret, null, 2));
      return ret.Stacks ? ret.Stacks[0] : undefined;
    } catch (err) {
      if (err.code == 'ValidationError') return undefined;
      throw err;
    }
  }

  async createStack(stackName: string, template: string) {
    const params = {
      StackName: stackName,
      TemplateBody: template,
      Capabilities: ['CAPABILITY_AUTO_EXPAND']
    };
    const result = await this.cfn.createStack(params).promise();
    this.logger.debug(JSON.stringify(result, null, 2));
    return result.StackId;
  }

  async waitForCreate(stackName: string) {
    const params = {
      StackName: stackName
    };
    const ret = await this.cfn.waitFor('stackCreateComplete', params).promise();
    this.logger.debug(JSON.stringify(ret, null, 2));
  }

  async updateStack(stackName: string, template: string) {
    try {
      const params = {
        StackName: stackName,
        TemplateBody: template,
        Capabilities: ['CAPABILITY_AUTO_EXPAND']
      };
      const result = await this.cfn.updateStack(params).promise();
      this.logger.debug(JSON.stringify(result, null, 2));
      return result.StackId;
    } catch (err) {
      if (err.code === 'ValidationError' && err.message.match(/No updates/)) return undefined;
      throw err;
    }
  }

  async waitForUpdate(stackName: string) {
    const params = {
      StackName: stackName
    };
    const ret = await this.cfn.waitFor('stackUpdateComplete', params).promise();
    this.logger.debug(JSON.stringify(ret, null, 2));
  }

  async addPermissionToLambdaFunction(apiId: string, stageName: string, functionName: string) {
    const hasPermission = await this.hasPermission(apiId, functionName, stageName);
    if (hasPermission) return;
    await this.addPermission(apiId, functionName, stageName);
  }

  async hasPermission(apiId: string, functionName: string, stageName: string) {
    const params = {
      FunctionName: functionName,
      Qualifier: stageName
    };
    try {
      const result = await this.lambda.getPolicy(params).promise();
      this.logger.debug(JSON.stringify(result, null, 2));
      if (!result.Policy) return false;
      const policy = JSON.parse(result.Policy);
      this.logger.debug(JSON.stringify(policy, null, 2));
      return policy.Statement.find((st: any) => st.Sid == `${apiId}_${stageName}`);
    } catch (err) {
      if (err.code == 'ResourceNotFoundException') return false;
      throw err;
    }
  }

  async addPermission(apiId: string, functionName: string, stageName: string) {
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
    } catch (err) {
      if (err.code === 'ResourceNotFoundException') {
        throw new Error(err.message);
      }
      throw err;
    }
  }

}
