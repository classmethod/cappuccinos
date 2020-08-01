import * as AWS from 'aws-sdk';
import { ProjectConfig, AwsConfig } from './types';
import * as utils from './utils';
import { blue } from 'colorette';
import { CappuccinosBase } from './CappuccinosBase'

export class Logs extends CappuccinosBase {

  constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
    super(env, options, logger, config, awsConfig, './build/logs');        
  }

  async updateAll() {
    const functions = utils.listFunctions(this.projectConfig.functions.paths);
    await Promise.all(
        functions.map(func => this.update(func))
    );
  }

  async update(functionPath: string) {
    const functionName = utils.toFunctionName(functionPath);
    const logGroupName = `/aws/lambda/${functionName}`;
    const exist = await this.existLogGroup(logGroupName);
    if (!exist) {
      await this.createLogGroup(logGroupName);
      this.logger.info(`  # LogGroup created         ${blue('function=')}${functionName}`);
    }
    const retentionInDays = this.getLogRetentionInDays(functionPath);
    if (retentionInDays && 0 < retentionInDays) {
      await this.putRetentionPolicy(logGroupName, retentionInDays);
      this.logger.info(`  # LogGroup putRetention    ${blue('function=')}${functionName} ${blue('retentionInDays=')}${retentionInDays}`);
    } else {
      await this.deleteRetentionPolicy(logGroupName);
      this.logger.info(`  # LogGroup deleteRetention ${blue('function=')}${functionName}`);
    }
  }

  private getLogRetentionInDays(functionPath: string): number | undefined {
    const envFuncConf = utils.loadYaml(`./functions/${functionPath}/function.${this.env}.yaml`);
    if (envFuncConf && envFuncConf.log_retention_in_days) return envFuncConf.log_retention_in_days;
    const funcConf = utils.loadYaml(`./functions/${functionPath}/function.yaml`);
    if (funcConf && funcConf.log_retention_in_days) return funcConf.log_retention_in_days;
    return this.projectConfig.functions.configuration.log_retention_in_days;
  }

  private async existLogGroup(logGroupName: string) {
    const params = {
      logGroupNamePrefix: logGroupName,
    };
    const resp = await this.logs.describeLogGroups(params).promise();
    this.logger.debug(JSON.stringify(resp, null, 2));
    if (!resp.logGroups || resp.logGroups.length === 0) return false;
    return (resp.logGroups.find(e => e.logGroupName === logGroupName) !== undefined);
  }

  private async createLogGroup(logGroupName: string) {
    const params = {
        logGroupName: logGroupName,
    };
    const resp = await this.logs.createLogGroup(params).promise();
    this.logger.debug(JSON.stringify(resp, null, 2));
  }

  private async putRetentionPolicy(logGroupName: string, retentionInDays: number) {
    const params: AWS.CloudWatchLogs.PutRetentionPolicyRequest = {
      logGroupName: logGroupName,
      retentionInDays: retentionInDays,
    };
    const resp = await this.logs.putRetentionPolicy(params).promise();
    this.logger.debug(JSON.stringify(resp, null, 2));
  }

  private async deleteRetentionPolicy(logGroupName: string) {
    const params: AWS.CloudWatchLogs.DeleteRetentionPolicyRequest = {
      logGroupName: logGroupName,
    };
    const resp = await this.logs.deleteRetentionPolicy(params).promise();
    this.logger.debug(JSON.stringify(resp, null, 2));
  }

}