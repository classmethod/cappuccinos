import { statSync, createWriteStream } from 'fs';
import { IFile } from './types';
import { sync as glob } from 'glob';
import * as archiver from 'archiver';

export class Archiver {

    logger: any;
    files: ArchiveFile[];

    constructor(logger: any) {
        this.logger = logger;
        this.files = [];
    }

    append(basePath: string, iFiles: IFile[]) {
        iFiles.map(iFile => {
            this.logger.debug(iFile);
            const opts = {
                cwd: iFile.base_dir ? `${basePath}/${iFile.base_dir}` : basePath
            }; // ignore: this.ignore
            this.logger.debug(opts);
            const sources = glob(iFile.source, opts);
            this.logger.debug(sources);
            sources
                .filter(source => !statSync(`${opts.cwd}/${source}`).isDirectory())
                .map(source => {
                    this.files.push({
                        source: `${opts.cwd}/${source}`,
                        name: `${iFile.destination}${`${opts.cwd}/${source}`.replace(opts.cwd, '')}`
                    });
                });
        });
    }

    async zip(outPath: string) {
        const output = createWriteStream(outPath);
        const zip = archiver.create('zip');
        return new Promise(resolve => {
            output.on('close', () => {
                resolve();
            });
            zip.pipe(output);
            this.files.map(file => {
                zip.file(file.source, { name: file.name });
            });
            zip.finalize();
        });
    }

}

interface ArchiveFile {
    source: string;
    name: string;
}
