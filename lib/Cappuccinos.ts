import * as AWS from 'aws-sdk';
import { Layers } from './Layers';
import { Functions } from './Functions';
import { AwsConfig } from './types';
import * as utils from './utils';
import { green } from 'colorette';

export const newLayers = async (env: string, options: any, logger: any): Promise<Layers> => {
    const cap = new Cappuccinos(env, options, logger);
    const config = await cap.loadProjectConfig();
    await cap.initAwsSdk();
    return new Layers(env, options, logger, config);
}

export const newFunctions = async (env: string, options: any, logger: any): Promise<Functions> => {
    const cap = new Cappuccinos(env, options, logger);
    const config = await cap.loadProjectConfig();
    await cap.initAwsSdk();
    return new Functions(env, options, logger, config);
}
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
    env: string;
    options: any;
    logger: any;

    constructor(env: string, options: any, logger: any) {        
        this.logger = logger;
        this.env = env;
        this.options = options;
    }

    async loadProjectConfig() {
        this.logger.debug(`[Load] project.yaml`);
        this.logger.info(`ENV: ${green(this.env)}`);
        const config = await utils.loadProjectConfig(this.env);
        this.logger.debug(JSON.stringify(config, null, 2));
        return config;
    }

    async initAwsSdk(): Promise<AwsConfig | undefined> {
        const awsConfig = await utils.getAwsConfig(this.env);
        if (!this.options.ignoreProfile && awsConfig) {
            this.logger.info(`AWS_PROFILE: ${green(awsConfig.aws_profile)}`);
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