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
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
const CappuccinosBase_1 = require("./CappuccinosBase");
class WebSocketApis extends CappuccinosBase_1.CappuccinosBase {
    constructor(env, options, logger, config, awsConfig) {
        super(env, options, logger, config, awsConfig, './build/websocketapis');
    }
    async cleanup() {
        await utils.cleanupDir(this.buidDir);
        this.logger.info(`  # cleanup`);
    }
    async deploy() {
        if (this.projectConfig.websockets === undefined)
            return;
        await Promise.all(this.projectConfig.websockets.map(name => this.deployApi(name)));
    }
    async deployApi(name) {
        const stackName = this.getStackName(name);
        this.logger.debug(stackName);
        const stack = await this.describeStack(stackName);
        const template = this.getTemplate(name);
        if (stack === undefined) {
            await this.createStack(stackName, template);
            this.logger.info(`  # WebSocket API create start ${colorette_1.blue('stackName=')}${stackName}`);
            await this.waitForCreate(stackName);
            this.logger.info(`  # WebSocket API created      ${colorette_1.blue('stackName=')}${stackName}`);
        }
        else {
            const stackId = await this.updateStack(stackName, template);
            if (stackId) {
                this.logger.info(`  # WebSocket API update start ${colorette_1.blue('stackName=')}${stackName}`);
                await this.waitForUpdate(stackName);
                this.logger.info(`  # WebSocket API updated      ${colorette_1.blue('stackName=')}${stackName}`);
            }
            else {
                this.logger.info(`  # WebSocket API No updates   ${colorette_1.blue('stackName=')}${stackName}`);
            }
        }
    }
    getStackName(name) {
        return `${this.projectConfig.name}-websocket-${name}`;
    }
    getTemplate(name) {
        return fs_1.readFileSync(`websockets/${name}/websocket.yaml`, 'utf-8');
    }
}
exports.WebSocketApis = WebSocketApis;
//# sourceMappingURL=WebSocketApis.js.map