import { statSync, createWriteStream } from 'fs';
import { IFile } from './types';
import { sync as glob } from 'glob';
import * as archiver from 'archiver';

export class Archiver {

    logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    async zip(outPath: string, basePath: string, iFiles: IFile[]) {
        const targets = iFiles.map(iFile => {
            this.logger.debug(iFile);
            const opts = {
                cwd: iFile.base_dir ? `${basePath}/${iFile.base_dir}` : basePath
            }; // ignore: this.ignore
            this.logger.debug(opts);
            const sources = glob(iFile.source, opts);
            this.logger.debug(sources);
            return sources
                .filter(source => !statSync(`${opts.cwd}/${source}`).isDirectory())
                .map(source => ({
                    source: `${opts.cwd}/${source}`,
                    name: `${iFile.destination}${`${opts.cwd}/${source}`.replace(opts.cwd, '')}`
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
