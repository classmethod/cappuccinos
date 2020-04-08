import { readFileSync } from 'fs';
import * as AWS from 'aws-sdk';
import { Process } from './Process';
import { Archiver } from './Archiver';
import * as utils from './utils';
import { ProjectConfig, LayersConfig } from './types';
import { blue } from 'colorette';

export class Layers {

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
        this.buidDir = './build/layers';
        this.projectConfig = config;
        this.dryRun = this.options.dryRun;
        this.lambda = new AWS.Lambda();
    }

    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }    

    getConf(layerName: string): LayersConfig {
        const config = this.projectConfig.layers.find(l => l.name === layerName);
        if (config === undefined) throw new Error(`Cant find layer's config`);
        return config;
    }

    async buildAll() {
        await Promise.all(
            this.projectConfig.layers.map(layer => this.build(layer.name))
        );
    }

    async build(layerName: string): Promise<string> {
        const conf = this.getConf(layerName);
        this.logger.debug(`> build: ${layerName}`);
        const path = `./layers/${layerName}`;
        const opts = { cwd: path };
        this.logger.debug(opts);
        new Process(this.logger).execCommand(conf.build, opts);
        const out = `${this.buidDir}/${layerName}-${this.env}.zip`;
        const archiver = new Archiver(this.logger);
        archiver.append(`./layers/${layerName}`, conf.files);
        await archiver.zip(out);
        this.logger.info(`  # Build layer      ${blue('layer=')}${layerName}`);
        return out;
    }

    async deployAll() {
        await Promise.all(
            this.projectConfig.layers.map(layer => this.deploy(layer.name))
        );
    }

    async deploy(layerName: string) {
        const file = await this.build(layerName);
        const latestVersion = await this.publish(layerName, this.getConf(layerName).runtimes, file);
        this.logger.info(`  # Layer published      ${blue('layer=')}${layerName},  ${blue('version=')}${latestVersion}`);
    }

    async publish(layerName: string, runtimes: string[], file: string): Promise<number> {
        const data = readFileSync(file);
        const params = {
            LayerName: layerName,
            CompatibleRuntimes: runtimes,
            Content: {
                ZipFile: data
            }
        };
        if (this.dryRun) return 0;
        const ret = await this.lambda.publishLayerVersion(params).promise();
        this.logger.debug(`${layerName}:${ret.Version}`);
        if (ret.Version === undefined) throw new Error('publishLayerVersion is failed.');
        return ret.Version;
    }
}
