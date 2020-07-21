import { readFileSync } from 'fs';
import { ProjectConfig, AwsConfig } from './types';
import * as utils from './utils';
import { blue } from 'colorette';
import { CappuccinosBase } from './CappuccinosBase'

export class WebSocketApis extends CappuccinosBase {

  constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
    super(env, options, logger, config, awsConfig, './build/websocketapis');
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

  private getStackName(name: string) {
    return `${this.projectConfig.name}-websocket-${name}`;
  }

  private getTemplate(name: string): string {
    return readFileSync(`websockets/${name}/websocket.yaml`, 'utf-8');
  }
}