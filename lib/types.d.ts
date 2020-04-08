export interface AwsConfig {
    aws_profile: string;
    account_id: string;
}

export interface ProjectConfig {
    name: string;
    functions: FunctionsConfig;
    layers: LayersConfig[];
    shared: SharedConfig[];
}

export interface FunctionsConfig {
    paths: string[];
    build: string[];
    rebuild: string[];
    files: IFile[];
    configuration: LambdaConfig;
}

export interface LambdaConfig {
    description?: string;
    runtime: string;
    timeout: number;
    role: string;
    handler: string;
    memory: number;
    environment: { [key: string]: string; };
    layers: string[];
}

export interface SharedConfig {
    name: string;
    build: string[];
    rebuild: string[];
    files: IFile[];
}

export interface LayersConfig {
    name: string;
    runtimes: string[];
    build: string[];
    files: IFile[];
}

export interface IFile {
    base_dir: string;
    source: string;
    destination: string;
}
