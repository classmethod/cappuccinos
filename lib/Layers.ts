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
    accountId: string;

    constructor(env: string, options: any, logger: any, config: ProjectConfig, accountId: string) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/layers';
        this.projectConfig = config;
        this.accountId = accountId;
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
        await archiver.zip(out, `./layers/${layerName}`, conf.files);
        this.logger.info(`  # Build layer      ${blue('layer=')}${layerName}`);
        return out;
    }

}
