"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
class Process {
    constructor(logger) {
        this.logger = logger;
    }
    execCommand(commands, opts) {
        for (let i = 0, len = commands.length; i < len; i++) {
            const cmd = commands[i];
            this.logger.debug(cmd);
            try {
                const out = child_process_1.execSync(cmd, opts);
                this.logger.debug(out.toString());
            }
            catch (err) {
                this.logger.error(err.stdout.toString());
                throw new Error(`execCommand error: ${cmd}, ${opts.cwd}`);
                ;
            }
        }
    }
}
exports.Process = Process;
//# sourceMappingURL=Process.js.map