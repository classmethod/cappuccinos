import * as AWS from 'aws-sdk';
import { Process } from './Process';
import { ProjectConfig } from './types';
import { Archiver } from './Archiver';
import * as utils from './utils';
import { blue } from 'colorette';

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

    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }

    async buildAll() {
        await this.prepareBuild();
        const functions =await utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(
            functions.map(functionPath => this.build(functionPath))
        );
    }

    async buildFunction(functionPath: string) {
        await this.prepareBuild();
        await this.build(functionPath);
    }

    async build(functionPath: string) {
        this.logger.debug(`> build: ${functionPath}`);
        const path = `./functions/${functionPath}`;
        const functionName = utils.toFunctionName(functionPath);
        const conf = this.projectConfig.functions;
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? conf.rebuild : conf.build;
        new Process(this.logger).execCommand(cmd, opts);
        const archiver = new Archiver(this.logger);
        archiver.append(`./functions/${functionPath}`, conf.files);
        for (let i = 0, len = this.projectConfig.shared.length; i < len; i++) {
            const shared = this.projectConfig.shared[i];
            archiver.append(`./shared/${shared.name}`, shared.files);
        }
        const out = `${this.buidDir}/${functionName}-${this.env}.zip`;
        await archiver.zip(out);
        this.logger.info(`  # Build function     ${blue('function=')}${functionName}`);
        return out;
    }

    async prepareBuild() {
        await this.buildSharedAll();
    }

    async buildSharedAll() {
        await Promise.all(
            this.projectConfig.shared.map(config => this.buildShared(config.name))
        );
    }
    
    async buildShared(name: string) {
        this.logger.debug(`> build shared: ${name}`);
        const path = `./shared/${name}`;
        const config = this.projectConfig.shared.find(s => s.name === name);
        if (config === undefined) throw new Error(`Cant find layer's config`);
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? config.rebuild : config.build;
        new Process(this.logger).execCommand(cmd, opts);
    }
}
