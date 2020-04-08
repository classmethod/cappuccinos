"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Process_1 = require("./Process");
const Archiver_1 = require("./Archiver");
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
class Layers {
    constructor(env, options, logger, config, accountId) {
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
    getConf(layerName) {
        const config = this.projectConfig.layers.find(l => l.name === layerName);
        if (config === undefined)
            throw new Error(`Cant find layer's config`);
        return config;
    }
    async buildAll() {
        await Promise.all(this.projectConfig.layers.map(layer => this.build(layer.name)));
    }
    async build(layerName) {
        const conf = this.getConf(layerName);
        this.logger.debug(`> build: ${layerName}`);
        const path = `./layers/${layerName}`;
        const opts = { cwd: path };
        this.logger.debug(opts);
        new Process_1.Process(this.logger).execCommand(conf.build, opts);
        const out = `${this.buidDir}/${layerName}-${this.env}.zip`;
        const archiver = new Archiver_1.Archiver(this.logger);
        await archiver.zip(out, `./layers/${layerName}`, conf.files);
        this.logger.info(`  # Build layer      ${colorette_1.blue('layer=')}${layerName}`);
        return out;
    }
}
exports.Layers = Layers;
//# sourceMappingURL=Layers.js.map