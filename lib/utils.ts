import { promises as fs, readFileSync, readdirSync, existsSync } from 'fs';
import * as YAML from 'yaml';
import { ProjectConfig, AwsConfig } from './types';
import { Blob } from 'aws-sdk/lib/dynamodb/document_client';

export const sleep = async (msec: number) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, msec);
    })
}

export const loadYaml = (path: string, transformer?: Function): any|undefined => {
    try {
        const doc = readFileSync(path, 'utf8');
        if (transformer) {
            return YAML.parse(transformer.call(transformer, doc));
        } else {
            return YAML.parse(doc);
        }
    } catch (err) {
        return undefined;
    }
}

export const loadProjectConfig = async (env: string, awsConfig: AwsConfig): Promise<ProjectConfig> => {
    const transformer = (doc: string) => {
        return doc.replace(/\$\{AWS::AccountId\}/g, awsConfig.account_id);
    };
    const config = loadYaml(`./conf/project.yaml`, transformer);
    const envConf = loadYaml(`./conf/${env}/project.yaml`, transformer);
    if (envConf) {
        Object.keys(envConf).map(key => {
            config[key] = envConf[key];
        });
    }
    const functionsEnvConf = loadYaml(`./conf/${env}/functions.yaml`, transformer);
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
    return config as ProjectConfig;
}

export const getAwsConfig = async (env: string): Promise<AwsConfig | undefined> => {
    return loadYaml(`./conf/${env}/aws.yaml`);
}

export const cleanupDir = async (dirPath: string) => {
    try {
        await fs.rmdir(dirPath, { recursive: true });
    } catch(err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
    await fs.mkdir(dirPath, { recursive: true });
}

export const toFunctionName = (func: string): string => {
    if (func.indexOf('/') === 0) return func;
    return func.split('/').join('_');
}

export const toFunctionPath = (functionName: string): string => {
    if (functionName.indexOf('/') !== -1) return functionName;
    return functionName.replace('_', '/');
}

export const listFunctions = (paths: string[]) => {
    return paths.map(
            path => readdirSync(`./functions/${path}`).map(d => `${path}/${d}`)
        ).flat()
         .filter(path => existsSync(`./functions/${path}/function.yaml`));
}

export const payloadToObject = (payload: Buffer | Uint8Array | Blob | string | undefined) => {
    if (payload === undefined) return undefined;
    return JSON.parse(payload.toString());
}

export const removeExamples = (obj: any) => {
    const rm = (obj: any) => {
        Object.keys(obj).forEach(key => {
            if (key == 'example') {
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                rm(obj[key]);
            }
        });
    };
    Object.keys(obj).forEach(key => rm(obj[key]));
}

export const notUndefined = <T>(value: T | undefined): value is T => {
    return value !== undefined;
}

export const awsConfigTransformer = (awsConfig: AwsConfig) => {
    const replace = (doc: string): string => {
        let tmp = doc.replace(/\$\{AWS::AccountId\}/g, awsConfig.account_id);
        tmp = tmp.replace(/\$\{AWS::Region\}/g, awsConfig.region);
        if (doc === tmp) return tmp;
        return replace(tmp);
    }
    return (doc: string) => {
        return replace(doc);
    };
}

export const mergeExtraVars = (payload: any, extraVars: { [key: string]: any }) => {
    Object.keys(extraVars).forEach(key => {
        if (key.indexOf('.') == -1) {
            payload[key] = extraVars[key];
        } else {
            const keys = key.split('.');
            payload[keys[0]][keys[1]] = extraVars[key];
        }
    });
    return payload;
}
