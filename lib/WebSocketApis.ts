import { readFileSync } from 'fs';
import * as AWS from 'aws-sdk';
import { ProjectConfig, AwsConfig } from './types';
import * as utils from './utils';
import { blue } from 'colorette';
import { CappuccinosBase } from './CappuccinosBase'

export class WebSocketApis extends CappuccinosBase {

  protected apigatewayv2: AWS.ApiGatewayV2;

  constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
    super(env, options, logger, config, awsConfig, './build/websocketapis');
    this.apigatewayv2 = new AWS.ApiGatewayV2();
  }

  async cleanup() {
    await utils.cleanupDir(this.buidDir);
    this.logger.info(`  # cleanup`);
  }

  async deploy() {
    if (this.projectConfig.websockets === undefined) return
    await Promise.all(
      this.projectConfig.websockets.map(name => this.deployApi(name))
    );
  }

  async deployApi(name: string) {
    const stackName = this.getStackName(name);
    this.logger.debug(stackName);
    const stack = await this.describeStack(stackName);
    const template = this.getTemplate(name);
    if (stack === undefined) {
      await this.createStack(stackName, template);
      this.logger.info(`  # WebSocket API create start ${blue('stackName=')}${stackName}`);
      await this.waitForCreate(stackName);
      this.logger.info(`  # WebSocket API created      ${blue('stackName=')}${stackName}`);
    } else {
      const stackId = await this.updateStack(stackName, template);
      if (stackId) {
        this.logger.info(`  # WebSocket API update start ${blue('stackName=')}${stackName}`);
        await this.waitForUpdate(stackName);
        this.logger.info(`  # WebSocket API updated      ${blue('stackName=')}${stackName}`);
      } else {
        this.logger.info(`  # WebSocket API No updates   ${blue('stackName=')}${stackName}`);
      }
    }
  }

  async deployApiStages(stageName: string) {
    if (this.projectConfig.websockets === undefined) return
    await Promise.all(
        this.projectConfig.websockets.map(name => this.deployApiStage(name, stageName))
    );
  }

  async deployApiStage(apiName: string, stageName: string) {
    const apiId = await this.getApiId(apiName);
    if (apiId === undefined) throw new Error(`Not found api name: ${apiName}`);
    this.logger.debug(`apiName: ${apiName}, apiId: ${apiId}`);
    const stage = await this.getStage(apiId, stageName);
    if (stage === undefined) {
      await this.createStage(apiId, stageName);
    }
    const deploymentId = await this.createDeployment(apiId, stageName);
    this.logger.debug(deploymentId);

    this.logger.info(`  # Stage deployed    ${blue('api=')}${apiName}, ${blue('stage=')}${stageName}`);
  }
  
  private getStackName(name: string) {
    return `${this.projectConfig.name}-websocket-${name}`;
  }

  private getTemplate(name: string): string {
    return readFileSync(`websockets/${name}/websocket.yaml`, 'utf-8');
  }

  private async getApiId(apiName: string) {
    const params = {
    };
    const result = await this.apigatewayv2.getApis(params).promise();
    const api = result.Items?.find(item => item.Name === apiName);
    return api?.ApiId;
  }

  private async getStage(apiId: string, stageName: string) {
    const params = {
      ApiId: apiId,
    };
    const result = await this.apigatewayv2.getStages(params).promise();
    return result.Items?.find(item => item.StageName === stageName);
  }

  private async createStage(apiId: string, stageName: string) {
    const params = {
      ApiId: apiId,
      StageName: stageName,
      StageVariables: {
        version: stageName,
      },
    };
    await this.apigatewayv2.createStage(params).promise();
  }

  private async createDeployment(apiId: string, stageName: string) {
    const params = {
      ApiId: apiId,
      StageName: stageName,
    };
    const result = await this.apigatewayv2.createDeployment(params).promise();
    const id = result.DeploymentId;
    if (id === undefined) throw new Error(`deployment id is unknown: ${apiId}`);
    return id;
  }

}