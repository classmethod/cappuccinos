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
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
exports.newLayers = async (env, options, logger) => {
    logger.debug(`[Load] project.yaml`);
    logger.info(`ENV: ${colorette_1.green(env)}`);
    const config = await utils.loadProjectConfig(env);
    logger.debug(JSON.stringify(config, null, 2));
    if (!options.ignoreProfile) {
        const awsProfile = await utils.getAwsProfile(env);
        logger.info(`AWS_PROFILE: ${colorette_1.green(awsProfile)}`);
        AWS.config.credentials = new AWS.SharedIniFileCredentials({
            profile: awsProfile
        });
    }
    AWS.config.update({
        maxRetries: 15,
        retryDelayOptions: {
            customBackoff: retryCount => (Math.random() * 700 + 300)
        }
    });
    const accountId = await (async () => {
        const ret = await new AWS.STS().getCallerIdentity({}).promise();
        logger.debug(JSON.stringify(ret, null, 2));
        if (ret.Account === undefined)
            throw new Error('AccountId is unknown.');
        return ret.Account;
    })();
    logger.info(`AWS_ACCOUNT_ID: ${colorette_1.green(accountId)}`);
    if (AWS.config.region === undefined)
        throw new Error('Region is unknown.');
    const region = AWS.config.region;
    logger.info(`AWS_REGION: ${colorette_1.green(region)}`);
    return new Layers_1.Layers(env, options, logger, config, accountId);
};
//# sourceMappingURL=Cappuccinos.js.map