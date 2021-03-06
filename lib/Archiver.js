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
const glob_1 = require("glob");
const archiver = __importStar(require("archiver"));
class Archiver {
    constructor(logger) {
        this.logger = logger;
        this.files = [];
    }
    append(basePath, iFiles) {
        iFiles.map(iFile => {
            this.logger.debug(iFile);
            const opts = {
                cwd: iFile.base_dir ? `${basePath}/${iFile.base_dir}` : basePath
            }; // ignore: this.ignore
            this.logger.debug(opts);
            const sources = glob_1.sync(iFile.source, opts);
            this.logger.debug(sources);
            sources
                .filter(source => !fs_1.statSync(`${opts.cwd}/${source}`).isDirectory())
                .map(source => {
                this.files.push({
                    source: `${opts.cwd}/${source}`,
                    name: `${iFile.destination}${`${opts.cwd}/${source}`.replace(opts.cwd, '')}`
                });
            });
        });
    }
    async zip(outPath) {
        const output = fs_1.createWriteStream(outPath);
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
exports.Archiver = Archiver;
//# sourceMappingURL=Archiver.js.map