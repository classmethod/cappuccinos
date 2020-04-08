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
    }
    async zip(outPath, basePath, files) {
        const targets = files.map(file => {
            this.logger.debug(file);
            const opts = {
                cwd: file.base_dir ? `${basePath}/${file.base_dir}` : basePath
            }; // ignore: this.ignore
            this.logger.debug(opts);
            const sources = glob_1.sync(file.source, opts);
            this.logger.debug(sources);
            return sources
                .filter(source => !fs_1.statSync(`${opts.cwd}/${source}`).isDirectory())
                .map(source => ({
                source: `${opts.cwd}/${source}`,
                name: `${file.destination}${`${opts.cwd}/${source}`.replace(opts.cwd, '')}`
            }));
        }).flat();
        const output = fs_1.createWriteStream(outPath);
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
exports.Archiver = Archiver;
//# sourceMappingURL=Archiver.js.map