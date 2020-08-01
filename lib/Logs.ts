import * as AWS from 'aws-sdk';
import { ProjectConfig, AwsConfig, SubscriptionFilter } from './types';
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

  async subscribeAll() {
    const functions = utils.listFunctions(this.projectConfig.functions.paths);
    await Promise.all(
        functions.map(func => this.subscribe(func))
    );
  }

  async subscribe(functionPath: string) {
    const functionName = utils.toFunctionName(functionPath);
    const conf = this.getSubscriptionFilter(functionPath);
    const logGroupName = `/aws/lambda/${functionName}`;
    const filter = await this.getCurrentSubscriptionFilter(logGroupName);
    if (filter === undefined && conf) {
      // new
      await this.putSubscriptionFilter(logGroupName, conf);
      this.logger.info(`  # LogGroup SubscriptionFilter created  ${blue('LogGroup=')}${logGroupName}`);
    } else if (filter && conf && 
       (conf.name !== filter.name || (conf.pattern !== filter.pattern || conf.destination_arn !== filter.destination_arn))) {
      // update
      await this.deleteSubscriptionFilter(logGroupName, filter.name);
      await this.putSubscriptionFilter(logGroupName, conf);
      this.logger.info(`  # LogGroup SubscriptionFilter updated  ${blue('LogGroup=')}${logGroupName}`);
    } else if (filter && !conf) {
      // delete
      await this.deleteSubscriptionFilter(logGroupName, filter.name);
      this.logger.info(`  # LogGroup SubscriptionFilter deleted  ${blue('LogGroup=')}${logGroupName}`);
    }
  }

  private getSubscriptionFilter(functionPath: string): SubscriptionFilter | undefined {
    const envFuncConf = utils.loadYaml(`./functions/${functionPath}/function.${this.env}.yaml`);
    if (envFuncConf && envFuncConf.subscription_filter !== undefined) return envFuncConf.subscription_filter || undefined;
    const funcConf = utils.loadYaml(`./functions/${functionPath}/function.yaml`);
    if (funcConf && funcConf.subscription_filter !== undefined) return funcConf.subscription_filter || undefined;
    return this.projectConfig.functions.configuration.subscription_filter;
  }


  private async getCurrentSubscriptionFilter(logGroupName: string): Promise<SubscriptionFilter | undefined> {
    const params = {
      logGroupName: logGroupName,
    };
    const ret = await this.logs.describeSubscriptionFilters(params).promise();
    if (!ret.subscriptionFilters || ret.subscriptionFilters.length === 0) return undefined;
    const f = ret.subscriptionFilters[0];
    return {
      name: `${f.filterName}`,
      pattern: `${f.filterPattern}`,
      destination_arn: `${f.destinationArn}`,
    }
  }

  private async putSubscriptionFilter(logGroupName: string, filter: SubscriptionFilter): Promise<void> {
    const params = {
      logGroupName: logGroupName,
      filterName: filter.name,
      destinationArn: filter.destination_arn,
      filterPattern: filter.pattern,
    };
    await this.logs.putSubscriptionFilter(params).promise();
  }

  private async deleteSubscriptionFilter(logGroupName: string, filterName: string): Promise<void> {
    const params = {
      logGroupName: logGroupName,
      filterName: filterName,
    };
    await this.logs.deleteSubscriptionFilter(params).promise();
  }
}