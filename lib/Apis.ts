import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as AWS from 'aws-sdk';
import * as YAML from 'yaml';
import { sync as glob } from 'glob';
import { ProjectConfig, AwsConfig } from './types';
import * as utils from './utils';
import { blue } from 'colorette';

export class Apis {

    env: string;
    options: any;
    logger: any;
    buidDir: string;
    projectConfig: ProjectConfig;
    awsConfig: AwsConfig;
    dryRun: boolean;

    constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/apis';
        this.projectConfig = config;
        this.awsConfig = awsConfig;
        this.dryRun = this.options.dryRun;
    }

    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }

    async makeDocumentAll() {
        await Promise.all(
            this.projectConfig.apis.map(apiName => this.makeDocument(apiName))
        );
    }

    async makeDocument(apiName: string) {
        const yaml = await this.mergeSwaggerFile(apiName);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        writeFileSync(path, YAML.stringify(yaml));
        this.logger.debug(yaml);
        const out = execSync(`spectacle -t ${this.buidDir}/${apiName} ${path}`);
        this.logger.debug(out.toString());
        this.logger.info(`  # API document created        ${blue('api=')}${apiName}`);
    }

    async mergeSwaggerFile(apiName: string) {
        const swg = utils.loadYaml(`apis/${apiName}/swagger.yaml`);
        if (swg.paths === undefined) swg.paths = {};
        glob(`functions/${apiName}/**/api.yaml`).map(path => {
            const paths = utils.loadYaml(path);
            Object.keys(paths).map(key => {
                if (swg.paths[key] === undefined) swg.paths[key] = {};
                Object.keys(paths[key]).map(method => {
                    swg.paths[key][method] = paths[key][method];
                });
            });
        });
        if (swg.definitions === undefined) swg.definitions = {};
        glob(`apis/${apiName}/definitions/*.yaml`).map(path => {
            const definitions = utils.loadYaml(path);
            Object.keys(definitions).map(key => {
                swg.definitions[key] = definitions[key];
            });
        });
        return swg;
    }

}
