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
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
exports.newLayers = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const config = await cap.loadProjectConfig();
    await cap.initAwsSdk();
    return new Layers_1.Layers(env, options, logger, config);
};
exports.newFunctions = async (env, options, logger) => {
    const cap = new Cappuccinos(env, options, logger);
    const config = await cap.loadProjectConfig();
    await cap.initAwsSdk();
    return new Functions_1.Functions(env, options, logger, config);
};
/*
        const accountId = await (async () => {
            const ret = await new AWS.STS().getCallerIdentity({}).promise();
            this.logger.debug(JSON.stringify(ret, null, 2));
            if (ret.Account === undefined) throw new Error('AccountId is unknown.');
            return ret.Account;
        })();
        this.logger.info(`AWS_ACCOUNT_ID: ${green(accountId)}`);
        if (AWS.config.region === undefined) throw new Error('Region is unknown.');
*/
class Cappuccinos {
    constructor(env, options, logger) {
        this.logger = logger;
        this.env = env;
        this.options = options;
    }
    async loadProjectConfig() {
        this.logger.debug(`[Load] project.yaml`);
        this.logger.info(`ENV: ${colorette_1.green(this.env)}`);
        const config = await utils.loadProjectConfig(this.env);
        this.logger.debug(JSON.stringify(config, null, 2));
        return config;
    }
    async initAwsSdk() {
        const awsConfig = await utils.getAwsConfig(this.env);
        if (!this.options.ignoreProfile && awsConfig) {
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
        return awsConfig;
    }
}
//# sourceMappingURL=Cappuccinos.js.map