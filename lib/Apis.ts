import path from 'path';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as AWS from 'aws-sdk';
import * as YAML from 'yaml';
import { sync as glob } from 'glob';
import { ProjectConfig, AwsConfig, ApiConfig } from './types';
import * as utils from './utils';
import { blue, green } from 'colorette';
import { CappuccinosBase } from './CappuccinosBase'

export class Apis extends CappuccinosBase {

  constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
    super(env, options, logger, config, awsConfig, path.resolve('./build/apis'));
  }

  async cleanup() {
    await utils.cleanupDir(this.buidDir);
    this.logger.info(`  # cleanup`);
  }

  async makeDocumentAll() {
    await Promise.all(
      this.projectConfig.apis.map(api => this.makeDocument(api))
    );
  }

  async makeDocument(config: ApiConfig) {
    const apiName = config.name;
    const yaml = await this.mergeSwaggerFile(config);
    const path = `${this.buidDir}/${apiName}.swagger.yaml`;
    writeFileSync(path, YAML.stringify(yaml));
    this.logger.debug(yaml);
    this.logger.debug(`spectacle --target-dir ${this.buidDir}/${apiName} ${path}`);
    const out = execSync(`spectacle --target-dir ${this.buidDir}/${apiName} ${path}`);
    this.logger.debug(out.toString());
    this.logger.info(`  # API document created        ${blue('api=')}${apiName}`);
  }

  async mergeSwaggerFile(config: ApiConfig) {
    const apiName = config.name;
    const swg = utils.loadYaml(`apis/${apiName}/swagger.yaml`);
    if (swg.paths === undefined) swg.paths = {};
    glob(`functions/${apiName}/**/api.yaml`).map(path => {
      const paths = utils.loadYaml(path);
      Object.keys(paths).map(key => {
        if (swg.paths[key] === undefined) swg.paths[key] = {};
        Object.keys(paths[key]).map(method => {
          swg.paths[key][method] = paths[key][method];
        });
      });
    });
    glob(`apis/${apiName}/paths/*.yaml`).map(path => {
      const paths = utils.loadYaml(path);
      Object.keys(paths).map(key => {
        if (swg.paths[key] === undefined) swg.paths[key] = {};
        Object.keys(paths[key]).map(method => {
          swg.paths[key][method] = paths[key][method];
        });
      });
    });
    if (swg.definitions === undefined) swg.definitions = {};
    glob(`apis/${apiName}/definitions/*.yaml`).map(path => {
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
      this.logger.info(`  # API create start          ${blue('stackName=')}${stackName}`);
      await this.waitForCreate(stackName);
      this.logger.info(`  # API created               ${blue('stackName=')}${stackName}`);
    } else {
      const stackId = await this.updateStack(stackName, this.makeApiTemplateBody());
      if (stackId) {
        this.logger.info(`  # API update start          ${blue('stackName=')}${stackName}`);
        await this.waitForUpdate(stackName);
        this.logger.info(`  # API updated               ${blue('stackName=')}${stackName}`);
      } else {
        this.logger.info(`  # API No updates            ${blue('stackName=')}${stackName}`);
      }
    }
  }

  async uploadSwaggerFiles() {
    await Promise.all(
      this.projectConfig.apis.map(api => this.uploadSwaggerFile(api))
    );
  }

  async uploadSwaggerFile(config: ApiConfig) {
    const apiName = config.name;
    const yaml = await this.mergeSwaggerFile(config);
    utils.removeExamples(yaml);
    const path = `${this.buidDir}/${apiName}.swagger.yaml`;
    this.logger.debug(yaml);
    const accountId = this.awsConfig.account_id;
    const region = AWS.config.region;
    if (!region) throw new Error();
    let swagger = YAML.stringify(yaml);
    swagger = swagger.replace(/\$\{AWS::AccountId\}/g, accountId);
    swagger = swagger.replace(/\$\{AWS::Region\}/g, region);
    if (config.environment) {
      const keys = Object.keys(config.environment);
      for (let i = 0, len = keys.length; i < len; i++) {
        const key = keys[i];
        this.logger.debug(`${key}, ${config.environment[key]}`);
        const reg = new RegExp(`\\$\\{${key}\\}`, 'g');
        swagger = swagger.replace(reg, config.environment[key]);
      }
    }
    this.logger.debug(`upload: ${path} => templates-${region}-${accountId}/apis/${apiName}.swagger.yaml`);
    const params = {
      Bucket: `templates-${region}-${accountId}`,
      Key: `apis/${apiName}.swagger.yaml`,
      Body: swagger
    };
    await this.s3.putObject(params).promise();
    this.logger.info(`  # Uploaded   ${green(`s3://${params.Bucket}/${params.Key}`)}`);
  }

  makeApiTemplateBody(): string {
    const resouces: any = {};
    this.projectConfig.apis.map(api => {
      resouces[api.name] = {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Body: {
            'Fn::Transform': {
              Name: 'AWS::Include',
              Parameters: {
                Location: `s3://templates-${this.awsConfig.region}-${this.awsConfig.account_id}/apis/${api.name}.swagger.yaml`
              }
            }
          }
        }
      }
    });
    const body = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `${this.projectConfig.name} API`,
      Resources: resouces
    };
    this.logger.debug(YAML.stringify(body));
    return YAML.stringify(body);
  }

  async deployApiStages(stageName: string) {
    for (let i = 0, len = this.projectConfig.apis.length; i < len; i++ ) {
      const apiName = this.projectConfig.apis[i].name;
      await this.deployApiStage(apiName, stageName);
      await utils.sleep(500);
    }
  }

  async deployApiStage(apiName: string, stageName: string) {
    const apiId = await this.getApiId(apiName);
    const deploymentId = await this.createDeployment(apiId, stageName);
    this.logger.debug(deploymentId);
    await this.addPermissionToLambdaFunctions(apiId, stageName);
    this.logger.info(`  # Stage deployed    ${blue('api=')}${apiName}, ${blue('stage=')}${stageName}`);
  }

  async getApiId(apiName: string) {
    const stackName = this.getStackName();
    const params = {
      StackName: stackName,
      LogicalResourceId: apiName
    };
    const result = await this.cfn.describeStackResource(params).promise();
    this.logger.debug(JSON.stringify(result, null, 2));
    const apiId = result.StackResourceDetail?.PhysicalResourceId;
    if (apiId === undefined) throw new Error(`apiId is unknown: ${apiName}`);
    return apiId;
  }

  async createDeployment(apiId: string, stageName: string) {
    const params = {
      restApiId: apiId,
      stageName: stageName,
      variables: {
        version: stageName
      }
    };
    const result = await this.apigateway.createDeployment(params).promise();
    const id = result.id;
    if (id === undefined) throw new Error(`deployment id is unknown: ${apiId}`);
    return id;
  }

  async addPermissionToLambdaFunctions(apiId: string, stageName: string) {
    const functions = await this.getIntegrationFunctions(apiId);
    await Promise.all(
      functions.map(functionName => this.addPermissionToLambdaFunction(apiId, stageName, functionName))
    );
  }

  async getIntegrationFunctions(apiId: string): Promise<string[]> {
    const resources = await this.getResources(apiId);
    const paramsList = resources
      .map(r => {
        if (r.id === undefined) throw new Error('resouce id is undefined.');
        const resourceId = r.id;
        return Object.keys(r.resourceMethods || []).map(m => ({
          restApiId: apiId,
          resourceId,
          httpMethod: m
        }));
      })
      .flat();
    const result = await Promise.all(
      paramsList.map(params => this.apigateway.getIntegration(params).promise())
    );
    const functions = result
      .filter(i => (i.uri !== undefined) && (i.uri.indexOf(`:${this.awsConfig.account_id}:`) !== -1))
      .map(i => {
        if (i.uri === undefined) return undefined;
        const m = i.uri.match(/\:function\:([a-z0-9_]+)[\:\/]/);
        return m ? m[1] : undefined;
      })
      .filter(utils.notUndefined)
      .filter((x, i, self) => self.indexOf(x) === i); // unique;
    this.logger.debug(JSON.stringify(functions, null, 2));
    return functions;
  }

  async getResources(apiId: string) {
    const params = {
      restApiId: apiId
    };
    const result = await this.apigateway.getResources(params).promise();
    this.logger.debug(JSON.stringify(result, null, 2));
    return result.items || [];
  }

  private getStackName() {
    return `${this.projectConfig.name}-api`;
  }

}
