"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// const { execSync } = require('child_process');
class Process {
    constructor(logger) {
        this.logger = logger;
    }
    execCommand(commands, opts) {
        commands.map(cmd => {
            this.logger.debug(cmd);
            const out = child_process_1.execSync(cmd, opts);
            this.logger.debug(out.toString());
        });
    }
}
exports.Process = Process;
//# sourceMappingURL=Process.js.map