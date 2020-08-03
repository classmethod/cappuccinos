"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
const CappuccinosBase_1 = require("./CappuccinosBase");
class Logs extends CappuccinosBase_1.CappuccinosBase {
    constructor(env, options, logger, config, awsConfig) {
        super(env, options, logger, config, awsConfig, './build/logs');
    }
    async updateAll() {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(functions.map(func => this.update(func)));
    }
    async update(functionPath) {
        const functionName = utils.toFunctionName(functionPath);
        const logGroupName = `/aws/lambda/${functionName}`;
        const exist = await this.existLogGroup(logGroupName);
        if (!exist) {
            await this.createLogGroup(logGroupName);
            this.logger.info(`  # LogGroup created         ${colorette_1.blue('function=')}${functionName}`);
        }
        const retentionInDays = this.getLogRetentionInDays(functionPath);
        if (retentionInDays && 0 < retentionInDays) {
            await this.putRetentionPolicy(logGroupName, retentionInDays);
            this.logger.info(`  # LogGroup putRetention    ${colorette_1.blue('function=')}${functionName} ${colorette_1.blue('retentionInDays=')}${retentionInDays}`);
        }
        else {
            await this.deleteRetentionPolicy(logGroupName);
            this.logger.info(`  # LogGroup deleteRetention ${colorette_1.blue('function=')}${functionName}`);
        }
    }
    getLogRetentionInDays(functionPath) {
        const envFuncConf = utils.loadYaml(`./functions/${functionPath}/function.${this.env}.yaml`);
        if (envFuncConf && envFuncConf.log_retention_in_days)
            return envFuncConf.log_retention_in_days;
        const funcConf = utils.loadYaml(`./functions/${functionPath}/function.yaml`);
        if (funcConf && funcConf.log_retention_in_days)
            return funcConf.log_retention_in_days;
        return this.projectConfig.functions.configuration.log_retention_in_days;
    }
    async existLogGroup(logGroupName) {
        const params = {
            logGroupNamePrefix: logGroupName,
        };
        const resp = await this.logs.describeLogGroups(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
        if (!resp.logGroups || resp.logGroups.length === 0)
            return false;
        return (resp.logGroups.find(e => e.logGroupName === logGroupName) !== undefined);
    }
    async createLogGroup(logGroupName) {
        const params = {
            logGroupName: logGroupName,
        };
        const resp = await this.logs.createLogGroup(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
    }
    async putRetentionPolicy(logGroupName, retentionInDays) {
        const params = {
            logGroupName: logGroupName,
            retentionInDays: retentionInDays,
        };
        const resp = await this.logs.putRetentionPolicy(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
    }
    async deleteRetentionPolicy(logGroupName) {
        const params = {
            logGroupName: logGroupName,
        };
        const resp = await this.logs.deleteRetentionPolicy(params).promise();
        this.logger.debug(JSON.stringify(resp, null, 2));
    }
    async subscribeAll() {
        const functions = utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(functions.map(func => this.subscribe(utils.toFunctionPath(func))));
    }
    async subscribe(functionPath) {
        const functionName = utils.toFunctionName(functionPath);
        const conf = this.getSubscriptionFilter(functionPath);
        const logGroupName = `/aws/lambda/${functionName}`;
        const filter = await this.getCurrentSubscriptionFilter(logGroupName);
        if (filter === undefined && conf) {
            // new
            await this.putSubscriptionFilter(logGroupName, conf);
            this.logger.info(`  # LogGroup SubscriptionFilter created  ${colorette_1.blue('LogGroup=')}${logGroupName}`);
        }
        else if (filter && conf &&
            (conf.name !== filter.name || (conf.pattern !== filter.pattern || conf.destination_arn !== filter.destination_arn))) {
            // update
            await this.deleteSubscriptionFilter(logGroupName, filter.name);
            await this.putSubscriptionFilter(logGroupName, conf);
            this.logger.info(`  # LogGroup SubscriptionFilter updated  ${colorette_1.blue('LogGroup=')}${logGroupName}`);
        }
        else if (filter && !conf) {
            // delete
            await this.deleteSubscriptionFilter(logGroupName, filter.name);
            this.logger.info(`  # LogGroup SubscriptionFilter deleted  ${colorette_1.blue('LogGroup=')}${logGroupName}`);
        }
    }
    getSubscriptionFilter(functionPath) {
        const envFuncConf = utils.loadYaml(`./functions/${functionPath}/function.${this.env}.yaml`);
        if (envFuncConf && envFuncConf.subscription_filter !== undefined)
            return envFuncConf.subscription_filter || undefined;
        const funcConf = utils.loadYaml(`./functions/${functionPath}/function.yaml`);
        if (funcConf && funcConf.subscription_filter !== undefined)
            return funcConf.subscription_filter || undefined;
        return this.projectConfig.functions.configuration.subscription_filter;
    }
    async getCurrentSubscriptionFilter(logGroupName) {
        const params = {
            logGroupName: logGroupName,
        };
        const ret = await this.logs.describeSubscriptionFilters(params).promise();
        if (!ret.subscriptionFilters || ret.subscriptionFilters.length === 0)
            return undefined;
        const f = ret.subscriptionFilters[0];
        return {
            name: `${f.filterName}`,
            pattern: `${f.filterPattern}`,
            destination_arn: `${f.destinationArn}`,
        };
    }
    async putSubscriptionFilter(logGroupName, filter) {
        const params = {
            logGroupName: logGroupName,
            filterName: filter.name,
            destinationArn: filter.destination_arn,
            filterPattern: filter.pattern,
        };
        await this.logs.putSubscriptionFilter(params).promise();
    }
    async deleteSubscriptionFilter(logGroupName, filterName) {
        const params = {
            logGroupName: logGroupName,
            filterName: filterName,
        };
        await this.logs.deleteSubscriptionFilter(params).promise();
    }
}
exports.Logs = Logs;
//# sourceMappingURL=Logs.js.map