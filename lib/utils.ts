import { promises as fs } from 'fs';
import * as YAML from 'yaml';
import { ProjectConfig, AwsConfig } from './types';

export const loadYaml = async (path: string): Promise<any> => {
    try {
        const doc = await fs.readFile(path, 'utf8');
        return YAML.parse(doc);
    } catch (err) {
        return undefined;
    }
}

export const loadProjectConfig = async (env: string): Promise<ProjectConfig> => {
    const config = await loadYaml(`./conf/project.yaml`);
    const envConf = await loadYaml(`./conf/${env}/project.yaml`);
    if (envConf) {
        Object.keys(envConf).map(key => {
            config[key] = envConf[key];
        });
    }
    const functionsEnvConf = await loadYaml(`./conf/${env}/functions.yaml`);
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
    const yaml = await loadYaml(`./conf/aws.yaml`);
    if (yaml && yaml[env]) {
        return yaml[env];
    } else {
        return undefined;
    }
}

export const cleanupDir = async (dirPath: string) => {
    try {
        await fs.rmdir(dirPath, { recursive: true });
    } catch(err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
    }
    await fs.mkdir(dirPath, { recursive: true });
}