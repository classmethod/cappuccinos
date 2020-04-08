import { execSync } from 'child_process';
// const { execSync } = require('child_process');

export class Process {

    logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    execCommand(commands: string[], opts: any) {
        commands.map(cmd => {
            this.logger.debug(cmd);
            const out = execSync(cmd, opts);
            this.logger.debug(out.toString());
        });
    }

}