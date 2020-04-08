export interface AwsConfig {
    aws_profile: string;
    account_id: string;
}

export interface ProjectConfig {
    name: string;
    layers: LayersConfig[];
    shared: SharedConfig[];
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
