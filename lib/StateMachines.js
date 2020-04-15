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
class StateMachines {
    constructor(env, options, logger, config, awsConfig) {
        this.logger = logger;
        this.env = env;
        this.options = options;
        this.buidDir = './build/layers';
        this.projectConfig = config;
        this.awsConfig = awsConfig;
        this.dryRun = this.options.dryRun;
        this.stepFunctions = new AWS.StepFunctions();
    }
    async deployAll() {
        await Promise.all(this.projectConfig.state_machines.map(stateMachineName => this.deploy(stateMachineName)));
    }
    async deploy(stateMachineName) {
        const stateMachine = await this.describeStateMachine(stateMachineName);
        this.logger.debug(JSON.stringify(stateMachine, null, 2));
        if (stateMachine) {
            await this.updateStateMachine(stateMachine);
        }
        else {
            await this.createStateMachine(stateMachineName);
        }
        this.logger.info(`  # Deploy State Machine   ${colorette_1.blue('name=')}${stateMachineName}`);
    }
    async describeStateMachine(stateMachineName) {
        const params = {
            stateMachineArn: `arn:aws:states:${this.awsConfig.region}:${this.awsConfig.account_id}:stateMachine:${stateMachineName}`
        };
        try {
            const result = await this.stepFunctions.describeStateMachine(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
            return result;
        }
        catch (err) {
            return undefined;
        }
    }
    async createStateMachine(stateMachineName) {
        const config = this.loadConfig(stateMachineName);
        const definition = this.loadDefinition(stateMachineName);
        const params = {
            name: stateMachineName,
            roleArn: config.role,
            definition: JSON.stringify(definition, null, 2)
        };
        const result = await this.stepFunctions.createStateMachine(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
    }
    async updateStateMachine(stateMachine) {
        const config = this.loadConfig(stateMachine.name);
        const definition = this.loadDefinition(stateMachine.name);
        const params = {
            stateMachineArn: stateMachine.stateMachineArn,
            roleArn: config.role,
            definition: JSON.stringify(definition, null, 2)
        };
        const result = await this.stepFunctions.updateStateMachine(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
    }
    loadConfig(stateMachineName) {
        const config = utils.loadYaml(`./state_machines/${stateMachineName}/state_machine.yaml`, utils.awsConfigTransformer(this.awsConfig));
        if (config === undefined)
            throw new Error(`Cannot find ./state_machines/${stateMachineName}/state_machine.yaml`);
        return config;
    }
    loadDefinition(stateMachineName) {
        const definition = utils.loadYaml(`./state_machines/${stateMachineName}/definition.yaml`, utils.awsConfigTransformer(this.awsConfig));
        if (definition === undefined)
            throw new Error(`Cannot find ./state_machines/${stateMachineName}/definition.yaml`);
        return definition;
    }
    async startExecution(stateMachineName, extraVars = {}, eventName = 'test') {
        const payload = JSON.parse(fs_1.readFileSync(`./state_machines/${stateMachineName}/event.${eventName}.json`, 'utf8'));
        utils.mergeExtraVars(payload, extraVars);
        this.logger.info('>>>');
        this.logger.info(payload);
        const params = {
            stateMachineArn: `arn:aws:states:${this.awsConfig.region}:${this.awsConfig.account_id}:stateMachine:${stateMachineName}`,
            input: JSON.stringify(payload, null, 2)
        };
        const result = await this.stepFunctions.startExecution(params).promise();
        this.logger.debug(JSON.stringify(result, null, 2));
    }
}
exports.StateMachines = StateMachines;
//# sourceMappingURL=StateMachines.js.map