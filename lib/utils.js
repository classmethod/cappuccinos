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
exports.sleep = async (msec) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, msec);
    });
};
exports.loadYaml = (path, transformer) => {
    try {
        const doc = fs_1.readFileSync(path, 'utf8');
        if (transformer) {
            return YAML.parse(transformer.call(transformer, doc));
        }
        else {
            return YAML.parse(doc);
        }
    }
    catch (err) {
        return undefined;
    }
};
exports.loadProjectConfig = async (env, awsConfig) => {
    const transformer = (doc) => {
        let tmp = doc.replace(/\$\{AWS::AccountId\}/g, awsConfig.account_id);
        tmp = tmp.replace(/\$\{AWS::Region\}/g, awsConfig.region);
        if (doc === tmp)
            return tmp;
        return transformer(tmp);
    };
    const config = exports.loadYaml(`./conf/project.yaml`, transformer);
    const envConf = exports.loadYaml(`./conf/${env}/project.yaml`, transformer);
    if (envConf) {
        Object.keys(envConf).map(key => {
            config[key] = envConf[key];
        });
    }
    const functionsEnvConf = exports.loadYaml(`./conf/${env}/functions.yaml`, transformer);
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
exports.getAwsConfig = async (env) => {
    return exports.loadYaml(`./conf/${env}/aws.yaml`);
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
exports.toFunctionName = (func) => {
    if (func.indexOf('/') === 0)
        return func;
    return func.split('/').join('_');
};
exports.toFunctionPath = (functionName) => {
    if (functionName.indexOf('/') !== -1)
        return functionName;
    return functionName.replace('_', '/');
};
exports.listFunctions = (paths) => {
    return paths.map(path => fs_1.readdirSync(`./functions/${path}`).map(d => `${path}/${d}`)).flat()
        .filter(path => fs_1.existsSync(`./functions/${path}/function.yaml`));
};
exports.payloadToObject = (payload) => {
    if (payload === undefined)
        return undefined;
    return JSON.parse(payload.toString());
};
exports.removeExamples = (obj) => {
    const rm = (obj) => {
        Object.keys(obj).forEach(key => {
            if (key == 'example') {
                delete obj[key];
            }
            else if (typeof obj[key] === 'object') {
                rm(obj[key]);
            }
        });
    };
    Object.keys(obj).forEach(key => rm(obj[key]));
};
exports.notUndefined = (value) => {
    return value !== undefined;
};
exports.awsConfigTransformer = (awsConfig) => {
    const replace = (doc) => {
        let tmp = doc.replace(/\$\{AWS::AccountId\}/g, awsConfig.account_id);
        tmp = tmp.replace(/\$\{AWS::Region\}/g, awsConfig.region);
        if (doc === tmp)
            return tmp;
        return replace(tmp);
    };
    return (doc) => {
        return replace(doc);
    };
};
exports.mergeExtraVars = (payload, extraVars) => {
    Object.keys(extraVars).forEach(key => {
        if (key.indexOf('.') == -1) {
            payload[key] = extraVars[key];
        }
        else {
            const keys = key.split('.');
            payload[keys[0]][keys[1]] = extraVars[key];
        }
    });
    return payload;
};
exports.copyConfig = (source) => {
    const yamlStr = YAML.stringify(source);
    return YAML.parse(yamlStr);
};
exports.chunkArray = (array, len = 1) => {
    const chunk = Array(Math.ceil(array.length / len));
    return Array.from(chunk, (x, i) => array.slice(i * len, i * len + len));
};
//# sourceMappingURL=utils.js.map