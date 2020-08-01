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
}
exports.Logs = Logs;
//# sourceMappingURL=Logs.js.map