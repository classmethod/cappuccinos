import { writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as AWS from 'aws-sdk';
import * as YAML from 'yaml';
import { sync as glob } from 'glob';
import { ProjectConfig, AwsConfig } from './types';
import * as utils from './utils';
import { blue, green } from 'colorette';

export class Apis {

    env: string;
    options: any;
    logger: any;
    buidDir: string;
    projectConfig: ProjectConfig;
    awsConfig: AwsConfig;
    dryRun: boolean;
    s3: AWS.S3;
    cfn: AWS.CloudFormation;

    constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/apis';
        this.projectConfig = config;
        this.awsConfig = awsConfig;
        this.dryRun = this.options.dryRun;
        this.s3 = new AWS.S3();
        this.cfn = new AWS.CloudFormation();
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

    async deploy() {
        await this.uploadSwaggerFiles();
        const stackName = `${this.projectConfig.name}-api`;
        this.logger.debug(stackName);
        const stack = await this.describeStack(stackName);
        const templatePath = `./apis/apis.yaml`;
        if (stack === undefined) {
            await this.createStack(stackName, templatePath);
            this.logger.info(`  # API create start          ${blue('stackName=')}${stackName}`);
            await this.waitForCreate(stackName);
            this.logger.info(`  # API created               ${blue('stackName=')}${stackName}`);
        } else {
            await this.updateStack(stackName, templatePath);
            this.logger.info(`  # API update start          ${blue('stackName=')}${stackName}`);
            await this.waitForUpdate(stackName);
            this.logger.info(`  # API updated               ${blue('stackName=')}${stackName}`);
        }
    }

    async uploadSwaggerFiles() {
        await Promise.all(
            this.projectConfig.apis.map(apiName => this.uploadSwaggerFile(apiName))
        );
    }

    async uploadSwaggerFile(apiName: string) {
        const yaml = await this.mergeSwaggerFile(apiName);
        utils.removeExamples(yaml);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        this.logger.debug(yaml);
        const accountId = this.awsConfig.account_id;
        const region = AWS.config.region;
        if (!region) throw new Error();
        let swagger = YAML.stringify(yaml);
        swagger = swagger.replace(/\$\{AWS::AccountId\}/g, accountId);
        swagger = swagger.replace(/\$\{AWS::Region\}/g, region);
        this.logger.debug(`upload: ${path} => templates-${region}-${accountId}/apis/${apiName}.swagger.yaml`);
        const params = {
            Bucket: `templates-${region}-${accountId}`,
            Key: `apis/${apiName}.swagger.yaml`,
            Body: swagger
        };
        await this.s3.putObject(params).promise();
        this.logger.info(`  # Uploaded   ${green(`s3://${params.Bucket}/${params.Key}`)}`);
    }

    async describeStack(stackName: string) {
        try {
            const params = {
                StackName: stackName
            };
            const ret = await this.cfn.describeStacks(params).promise();
            this.logger.debug(JSON.stringify(ret, null, 2));
            return ret.Stacks ? ret.Stacks[0] : undefined;
        } catch (err) {
            if (err.code == 'ValidationError') return undefined;
            throw err;
        }
    }

    async createStack(stackName: string, templatePath: string) {
        const params = {
            StackName: stackName,
            TemplateBody: readFileSync(templatePath, 'utf8'),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.createStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }

    async updateStack(stackName: string, templatePath: string) {
        const params = {
            StackName: stackName,
            TemplateBody: readFileSync(templatePath, 'utf8'),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.updateStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }

    async waitForCreate(stackName: string) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackCreateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }

    async waitForUpdate(stackName: string) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackUpdateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
}
