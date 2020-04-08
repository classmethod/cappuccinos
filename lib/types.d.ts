
export interface ProjectConfig {
    name: string;
    layers: LayersConfig[];
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
