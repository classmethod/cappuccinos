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
const Layers_1 = require("./Layers");
const Functions_1 = require("./Functions");
const Apis_1 = require("./Apis");
const WebSocketApis_1 = require("./WebSocketApis");
const StateMachines_1 = require("./StateMachines");
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
exports.newLayers = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const awsConfig = await cap.initAwsSdk();
    const config = await cap.loadProjectConfig(awsConfig);
    return new Layers_1.Layers(env, options, logger, config);
};
exports.newFunctions = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const awsConfig = await cap.initAwsSdk();
    const config = await cap.loadProjectConfig(awsConfig);
    return new Functions_1.Functions(env, options, logger, config, awsConfig);
};
exports.newApis = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const awsConfig = await cap.initAwsSdk();
    const config = await cap.loadProjectConfig(awsConfig);
    return new Apis_1.Apis(env, options, logger, config, awsConfig);
};
exports.newWebSocketApis = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const awsConfig = await cap.initAwsSdk();
    const config = await cap.loadProjectConfig(awsConfig);
    return new WebSocketApis_1.WebSocketApis(env, options, logger, config, awsConfig);
};
exports.newStateMachines = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const awsConfig = await cap.initAwsSdk();
    const config = await cap.loadProjectConfig(awsConfig);
    return new StateMachines_1.StateMachines(env, options, logger, config, awsConfig);
};
class Cappuccinos {
    constructor(env, options, logger) {
        this.logger = logger;
        this.env = env;
        this.options = options;
    }
    async loadProjectConfig(awsConfig) {
        this.logger.debug(`[Load] project.yaml`);
        this.logger.info(`ENV: ${colorette_1.green(this.env)}`);
        const config = await utils.loadProjectConfig(this.env, awsConfig);
        this.logger.debug(JSON.stringify(config, null, 2));
        return config;
    }
    async initAwsSdk() {
        const awsConfig = await utils.getAwsConfig(this.env);
        if (!this.options.ignoreProfile && awsConfig && awsConfig.aws_profile) {
            this.logger.info(`AWS_PROFILE: ${colorette_1.green(awsConfig.aws_profile)}`);
            AWS.config.credentials = new AWS.SharedIniFileCredentials({
                profile: awsConfig.aws_profile
            });
        }
        AWS.config.update({
            maxRetries: 15,
            retryDelayOptions: {
                customBackoff: retryCount => (Math.random() * 700 + 300)
            }
        });
        if (awsConfig) {
            if (awsConfig.account_id === undefined)
                awsConfig.account_id = await this.getAccountId();
            if (awsConfig.region === undefined)
                awsConfig.region = AWS.config.region || 'ap-northeast-1';
            this.logger.info(`AWS_ACCOUNT_ID: ${colorette_1.green(awsConfig.account_id)}`);
            this.logger.info(`REGION: ${colorette_1.green(awsConfig.region)}`);
            return awsConfig;
        }
        else {
            const region = AWS.config.region || 'ap-northeast-1';
            const accountId = await this.getAccountId();
            this.logger.info(`AWS_ACCOUNT_ID: ${colorette_1.green(accountId)}`);
            this.logger.info(`REGION: ${colorette_1.green(region)}`);
            return {
                account_id: accountId,
                region
            };
        }
    }
    async getAccountId() {
        const accountId = await (async () => {
            const ret = await new AWS.STS().getCallerIdentity({}).promise();
            this.logger.debug(JSON.stringify(ret, null, 2));
            if (ret.Account === undefined)
                throw new Error('AccountId is unknown.');
            return ret.Account;
        })();
        return accountId;
    }
}
//# sourceMappingURL=Cappuccinos.js.map