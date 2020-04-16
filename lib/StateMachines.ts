import { readFileSync } from 'fs';
import * as AWS from 'aws-sdk';
import * as YAML from 'yaml';
import * as utils from './utils';
import { ProjectConfig, AwsConfig, StateMachineConfig } from './types';
import { blue } from 'colorette';

export class StateMachines {

    env: string;
    options: any;
    logger: any;
    buidDir: string;
    projectConfig: ProjectConfig;
    awsConfig: AwsConfig;
    dryRun: boolean;
    stepFunctions: AWS.StepFunctions;


    constructor(env: string, options: any, logger: any, config: ProjectConfig, awsConfig: AwsConfig) {
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
        if (!this.projectConfig.state_machines) return;
        await Promise.all(
            this.projectConfig.state_machines.map(stateMachineName => this.deploy(stateMachineName))
        );
    }

    async deploy(stateMachineName: string) {
        const stateMachine = await this.describeStateMachine(stateMachineName);
        this.logger.debug(JSON.stringify(stateMachine, null, 2));
        if (stateMachine) {
            await this.updateStateMachine(stateMachine);
        } else {
            await this.createStateMachine(stateMachineName);
        }
        this.logger.info(`  # Deploy State Machine   ${blue('name=')}${stateMachineName}`);
    }

    private async describeStateMachine(stateMachineName: string) {
        const params = {
            stateMachineArn: `arn:aws:states:${this.awsConfig.region}:${this.awsConfig.account_id}:stateMachine:${stateMachineName}`
        };
        try {
            const result = await this.stepFunctions.describeStateMachine(params).promise();
            this.logger.debug(JSON.stringify(result, null, 2));
            return result;
        } catch (err) {
            return undefined;
        }
    }

    private async createStateMachine(stateMachineName: string) {
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

    private async updateStateMachine(stateMachine: AWS.StepFunctions.DescribeStateMachineOutput) {
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

    private loadConfig(stateMachineName: string) {
        const config = utils.loadYaml(`./state_machines/${stateMachineName}/state_machine.yaml`, utils.awsConfigTransformer(this.awsConfig)) as StateMachineConfig;
        if (config === undefined) throw new Error(`Cannot find ./state_machines/${stateMachineName}/state_machine.yaml`);
        return config;
    }

    private loadDefinition(stateMachineName: string) {
        const definition = utils.loadYaml(`./state_machines/${stateMachineName}/definition.yaml`, utils.awsConfigTransformer(this.awsConfig));
        if (definition === undefined) throw new Error(`Cannot find ./state_machines/${stateMachineName}/definition.yaml`);
        return definition;
    }

    async startExecution(stateMachineName: string, extraVars: { [key: string]: any } = {}, eventName = 'test') {
        const payload = JSON.parse(readFileSync(`./state_machines/${stateMachineName}/event.${eventName}.json`, 'utf8'))
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