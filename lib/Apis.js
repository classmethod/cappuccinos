"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const AWS = __importStar(require("aws-sdk"));
const YAML = __importStar(require("yaml"));
const glob_1 = require("glob");
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
class Apis {
    constructor(env, options, logger, config, awsConfig) {
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
        await Promise.all(this.projectConfig.apis.map(apiName => this.makeDocument(apiName)));
    }
    async makeDocument(apiName) {
        const yaml = await this.mergeSwaggerFile(apiName);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        fs_1.writeFileSync(path, YAML.stringify(yaml));
        this.logger.debug(yaml);
        const out = child_process_1.execSync(`spectacle -t ${this.buidDir}/${apiName} ${path}`);
        this.logger.debug(out.toString());
        this.logger.info(`  # API document created        ${colorette_1.blue('api=')}${apiName}`);
    }
    async mergeSwaggerFile(apiName) {
        const swg = utils.loadYaml(`apis/${apiName}/swagger.yaml`);
        if (swg.paths === undefined)
            swg.paths = {};
        glob_1.sync(`functions/${apiName}/**/api.yaml`).map(path => {
            const paths = utils.loadYaml(path);
            Object.keys(paths).map(key => {
                if (swg.paths[key] === undefined)
                    swg.paths[key] = {};
                Object.keys(paths[key]).map(method => {
                    swg.paths[key][method] = paths[key][method];
                });
            });
        });
        if (swg.definitions === undefined)
            swg.definitions = {};
        glob_1.sync(`apis/${apiName}/definitions/*.yaml`).map(path => {
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
            this.logger.info(`  # API create start          ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForCreate(stackName);
            this.logger.info(`  # API created               ${colorette_1.blue('stackName=')}${stackName}`);
        }
        else {
            await this.updateStack(stackName, templatePath);
            this.logger.info(`  # API update start          ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForUpdate(stackName);
            this.logger.info(`  # API updated               ${colorette_1.blue('stackName=')}${stackName}`);
        }
    }
    async uploadSwaggerFiles() {
        await Promise.all(this.projectConfig.apis.map(apiName => this.uploadSwaggerFile(apiName)));
    }
    async uploadSwaggerFile(apiName) {
        const yaml = await this.mergeSwaggerFile(apiName);
        utils.removeExamples(yaml);
        const path = `${this.buidDir}/${apiName}.swagger.yaml`;
        this.logger.debug(yaml);
        const accountId = this.awsConfig.account_id;
        const region = AWS.config.region;
        if (!region)
            throw new Error();
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
        this.logger.info(`  # Uploaded   ${colorette_1.green(`s3://${params.Bucket}/${params.Key}`)}`);
    }
    async describeStack(stackName) {
        try {
            const params = {
                StackName: stackName
            };
            const ret = await this.cfn.describeStacks(params).promise();
            this.logger.debug(JSON.stringify(ret, null, 2));
            return ret.Stacks ? ret.Stacks[0] : undefined;
        }
        catch (err) {
            if (err.code == 'ValidationError')
                return undefined;
            throw err;
        }
    }
    async createStack(stackName, templatePath) {
        const params = {
            StackName: stackName,
            TemplateBody: fs_1.readFileSync(templatePath, 'utf8'),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.createStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }
    async updateStack(stackName, templatePath) {
        const params = {
            StackName: stackName,
            TemplateBody: fs_1.readFileSync(templatePath, 'utf8'),
            Capabilities: ['CAPABILITY_AUTO_EXPAND']
        };
        const result = await this.cfn.updateStack(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
        return result.StackId;
    }
    async waitForCreate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackCreateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
    async waitForUpdate(stackName) {
        const params = {
            StackName: stackName
        };
        const ret = await this.cfn.waitFor('stackUpdateComplete', params).promise();
        this.logger.debug(JSON.stringify(ret, null, 2));
    }
}
exports.Apis = Apis;
//# sourceMappingURL=Apis.js.map