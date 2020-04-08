"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = __importStar(require("aws-sdk"));
const Process_1 = require("./Process");
const Archiver_1 = require("./Archiver");
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
class Functions {
    constructor(env, options, logger, config) {
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
        const functions = await utils.listFunctions(this.projectConfig.functions.paths);
        await Promise.all(functions.map(functionPath => this.build(functionPath)));
    }
    async buildFunction(functionPath) {
        await this.prepareBuild();
        await this.build(functionPath);
    }
    async build(functionPath) {
        this.logger.debug(`> build: ${functionPath}`);
        const path = `./functions/${functionPath}`;
        const functionName = utils.toFunctionName(functionPath);
        const conf = this.projectConfig.functions;
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? conf.rebuild : conf.build;
        new Process_1.Process(this.logger).execCommand(cmd, opts);
        const archiver = new Archiver_1.Archiver(this.logger);
        archiver.append(`./functions/${functionPath}`, conf.files);
        for (let i = 0, len = this.projectConfig.shared.length; i < len; i++) {
            const shared = this.projectConfig.shared[i];
            archiver.append(`./shared/${shared.name}`, shared.files);
        }
        const out = `${this.buidDir}/${functionName}-${this.env}.zip`;
        await archiver.zip(out);
        this.logger.info(`  # Build function     ${colorette_1.blue('function=')}${functionName}`);
        return out;
    }
    async prepareBuild() {
        await this.buildSharedAll();
    }
    async buildSharedAll() {
        await Promise.all(this.projectConfig.shared.map(config => this.buildShared(config.name)));
    }
    async buildShared(name) {
        this.logger.debug(`> build shared: ${name}`);
        const path = `./shared/${name}`;
        const config = this.projectConfig.shared.find(s => s.name === name);
        if (config === undefined)
            throw new Error(`Cant find layer's config`);
        const opts = { cwd: path };
        this.logger.debug(opts);
        const cmd = this.options.rebuild ? config.rebuild : config.build;
        new Process_1.Process(this.logger).execCommand(cmd, opts);
    }
}
exports.Functions = Functions;
//# sourceMappingURL=Functions.js.map