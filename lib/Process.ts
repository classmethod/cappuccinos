import { execSync } from 'child_process';

export class Process {

    logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    execCommand(commands: string[], opts: any) {
        for (let i = 0, len = commands.length; i < len; i++) {
            const cmd = commands[i];
            this.logger.debug(cmd);
            try {
                const out = execSync(cmd, opts);
                this.logger.debug(out.toString());
            } catch (err) {
                this.logger.error(err.stdout.toString());
                throw new Error(`execCommand error: ${cmd}, ${opts.cwd}`);;
            }
        }
    }

}