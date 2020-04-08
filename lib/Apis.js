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
}
exports.Apis = Apis;
//# sourceMappingURL=Apis.js.map