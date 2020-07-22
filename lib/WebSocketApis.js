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
const AWS = __importStar(require("aws-sdk"));
const utils = __importStar(require("./utils"));
const colorette_1 = require("colorette");
const CappuccinosBase_1 = require("./CappuccinosBase");
class WebSocketApis extends CappuccinosBase_1.CappuccinosBase {
    constructor(env, options, logger, config, awsConfig) {
        super(env, options, logger, config, awsConfig, './build/websocketapis');
        this.apigatewayv2 = new AWS.ApiGatewayV2();
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
    async deployApiStages(stageName) {
        if (this.projectConfig.websockets === undefined)
            return;
        await Promise.all(this.projectConfig.websockets.map(name => this.deployApiStage(name, stageName)));
    }
    async deployApiStage(apiName, stageName) {
        const apiId = await this.getApiId(apiName);
        if (apiId === undefined)
            throw new Error(`Not found api name: ${apiName}`);
        this.logger.debug(`apiName: ${apiName}, apiId: ${apiId}`);
        const stage = await this.getStage(apiId, stageName);
        if (stage === undefined) {
            await this.createStage(apiId, stageName);
        }
        const deploymentId = await this.createDeployment(apiId, stageName);
        this.logger.debug(deploymentId);
        this.logger.info(`  # Stage deployed    ${colorette_1.blue('api=')}${apiName}, ${colorette_1.blue('stage=')}${stageName}`);
    }
    getStackName(name) {
        return `${this.projectConfig.name}-websocket-${name}`;
    }
    getTemplate(name) {
        return fs_1.readFileSync(`websockets/${name}/websocket.yaml`, 'utf-8');
    }
    async getApiId(apiName) {
        var _a;
        const params = {};
        const result = await this.apigatewayv2.getApis(params).promise();
        const api = (_a = result.Items) === null || _a === void 0 ? void 0 : _a.find(item => item.Name === apiName);
        return api === null || api === void 0 ? void 0 : api.ApiId;
    }
    async getStage(apiId, stageName) {
        var _a;
        const params = {
            ApiId: apiId,
        };
        const result = await this.apigatewayv2.getStages(params).promise();
        return (_a = result.Items) === null || _a === void 0 ? void 0 : _a.find(item => item.StageName === stageName);
    }
    async createStage(apiId, stageName) {
        const params = {
            ApiId: apiId,
            StageName: stageName,
            StageVariables: {
                version: stageName,
            },
        };
        await this.apigatewayv2.createStage(params).promise();
    }
    async createDeployment(apiId, stageName) {
        const params = {
            ApiId: apiId,
            StageName: stageName,
        };
        const result = await this.apigatewayv2.createDeployment(params).promise();
        const id = result.DeploymentId;
        if (id === undefined)
            throw new Error(`deployment id is unknown: ${apiId}`);
        return id;
    }
}
exports.WebSocketApis = WebSocketApis;
//# sourceMappingURL=WebSocketApis.js.map