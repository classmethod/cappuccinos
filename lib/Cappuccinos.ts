import * as AWS from 'aws-sdk';
import { Layers } from './Layers';
import { ProjectConfig } from './types';
import * as utils from './utils';
import { green, red } from 'colorette';

export const newLayers = async (env: string, options: any, logger: any): Promise<Layers> => {
    logger.debug(`[Load] project.yaml`);
    logger.info(`ENV: ${green(env)}`);
    const config = await utils.loadProjectConfig(env);
    logger.debug(JSON.stringify(config, null, 2));
    if (!options.ignoreProfile) {
        const awsProfile = await utils.getAwsProfile(env);
        logger.info(`AWS_PROFILE: ${green(awsProfile)}`);
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
        if (ret.Account === undefined) throw new Error('AccountId is unknown.');
        return ret.Account;
    })();
    logger.info(`AWS_ACCOUNT_ID: ${green(accountId)}`);
    if (AWS.config.region === undefined) throw new Error('Region is unknown.');
    const region = AWS.config.region;
    logger.info(`AWS_REGION: ${green(region)}`);
    return new Layers(env, options, logger, config, accountId);
}