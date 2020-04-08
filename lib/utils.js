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
const YAML = __importStar(require("yaml"));
exports.loadYaml = async (path) => {
    try {
        const doc = await fs_1.promises.readFile(path, 'utf8');
        return YAML.parse(doc);
    }
    catch (err) {
        return undefined;
    }
};
exports.loadProjectConfig = async (env) => {
    const config = await exports.loadYaml(`./conf/project.yaml`);
    const envConf = await exports.loadYaml(`./conf/${env}/project.yaml`);
    if (envConf) {
        Object.keys(envConf).map(key => {
            config[key] = envConf[key];
        });
    }
    const functionsEnvConf = await exports.loadYaml(`./conf/${env}/functions.yaml`);
    if (functionsEnvConf) {
        const functionsConf = config.functions.configuration;
        Object.keys(functionsEnvConf).map(key => {
            switch (key) {
                case 'environment':
                    Object.keys(functionsEnvConf[key]).map(envKey => {
                        functionsConf.environment[envKey] = functionsEnvConf[key][envKey];
                    });
                    break;
                case 'layers':
                    functionsConf.layers = functionsConf.layers.concat(functionsEnvConf.layers);
                    break;
                default:
                    functionsConf[key] = functionsEnvConf[key];
                    break;
            }
        });
    }
    return config;
};
exports.getAwsProfile = async (env) => {
    const yaml = await exports.loadYaml(`./conf/aws.yaml`);
    if (yaml && yaml[env] && yaml[env].aws_profile) {
        return yaml[env].aws_profile;
    }
    else {
        return env;
    }
};
exports.cleanupDir = async (dirPath) => {
    try {
        await fs_1.promises.rmdir(dirPath, { recursive: true });
    }
    catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR')
            throw err;
    }
    await fs_1.promises.mkdir(dirPath, { recursive: true });
};
//# sourceMappingURL=utils.js.map