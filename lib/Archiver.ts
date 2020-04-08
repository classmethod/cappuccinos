import { statSync, createWriteStream } from 'fs';
import { IFile } from './types';
import { sync as glob } from 'glob';
import * as archiver from 'archiver';

export class Archiver {

    logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    async zip(outPath: string, basePath: string, files: IFile[]) {
        const targets = files.map(file => {
            this.logger.debug(file);
            const opts = {
                cwd: file.base_dir ? `${basePath}/${file.base_dir}` : basePath
            }; // ignore: this.ignore
            this.logger.debug(opts);
            const sources = glob(file.source, opts);
            this.logger.debug(sources);
            return sources
                .filter(source => !statSync(`${opts.cwd}/${source}`).isDirectory())
                .map(source => ({
                    source: `${opts.cwd}/${source}`,
                    name: `${file.destination}${`${opts.cwd}/${source}`.replace(opts.cwd, '')}`
                })
            );
        }).flat();
        const output = createWriteStream(outPath);
        const zip = archiver.create('zip');
        return new Promise(resolve => {
            output.on('close', () => {
                resolve();
            });
            zip.pipe(output);
            targets.map(target => {
                zip.file(target.source, { name: target.name });
            });
            zip.finalize();
        });
    }

}
