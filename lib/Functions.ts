import * as AWS from 'aws-sdk';
import { ProjectConfig, LayersConfig } from './types';

export class Functions {

    env: string;
    options: any;
    logger: any;
    buidDir: string;
    projectConfig: ProjectConfig;
    dryRun: boolean;
    lambda: AWS.Lambda;

    constructor(env: string, options: any, logger: any, config: ProjectConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/functions';
        this.projectConfig = config;
        this.dryRun = this.options.dryRun;
        this.lambda = new AWS.Lambda();
    }

}
