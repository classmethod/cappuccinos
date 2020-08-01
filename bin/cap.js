#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const fs = require('fs');
const prog = require('caporal');
const { newLayers, newFunctions, newApis, newWebSocketApis, newStateMachines, newLogs } = require('../lib/Cappuccinos');
const utils = require('../lib/utils');

const envArgValidator = (arg) => {
  try {
    fs.statSync(`./conf/${arg}`);
  } catch (err) {
    throw new Error(`Can not find ./conf/${arg}`);
  }
  return arg;
};

const layerArgValidator = (arg) => {
  try {
    fs.statSync(`./layers/${arg}`);
  } catch (err) {
    throw new Error(`Can not find layer path ./layers/${arg}`);
  }
  return arg;
};

const functionArgValidator = (arg) => {
  try {
    fs.statSync(`./functions/${utils.toFunctionPath(arg)}`);
  } catch (err) {
    throw new Error(`Can not find function path ./functions/${utils.toFunctionPath(arg)}`);
  }
  return arg;
};

const apiArgValidator = (arg) => {
  try {
    fs.statSync(`./apis/${arg}/swagger.yaml`);
  } catch (err) {
    throw new Error(`Can not find api path ./apis/${arg}/swagger.yaml`);
  }
  return arg;
};

const stateMachineArgValidator = (arg) => {
  if (!fs.existsSync(`./state_machines/${arg}/state_machine.yaml`)) {
    throw new Error(`Can not find api path ./${arg}/state_machine.yaml`);
  }
  return arg;
};

const changeLogLevel = (logger, level) => {
  Object.keys(logger.transports).forEach(t => logger.transports[t].level = level)
};

const getExtraVars = (options) => {
  const val = (v) => {
    if (v.match(/^[0-9]+$/)) return Number(v);
    if (v.match(/^(true|false)$/)) return (v === 'true') ? true : false;
    return v;
  };
  const result = {};
  if (Array.isArray(options.vars)) {
    options.vars.forEach(v => {
      const tokens = v.split('=');
      result[tokens[0]] = val(tokens[1]);
    });
  } else if (options.vars) {
    const tokens = options.vars.split('=');
    result[tokens[0]] = val(tokens[1]);
  }
  return result;
}

prog
  .version('0.0.1')
  .description('deploy and publish AWS Lambda functions and API Gateway.')
  .command('layers build', 'Build layers.')
  .option('--ignore-profile', 'ignore aws profile')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[layer]', 'target layer to deploy', layerArgValidator)
  .action(async (args, options, logger) => {
    logger.info(`[Build Layers]`);
    const layers = await newLayers(args.env, options, logger);
    await layers.cleanup();
    if (args.layer) {
      await layers.build(args.layer);
    } else {
      await layers.buildAll();
    }
  })
  .command('layers deploy', 'Deploy layers.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[layer]', 'target layer to deploy', layerArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .option('--dry-run', 'dry-run ')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy Layers]`);
    const layers = await newLayers(args.env, options, logger);
    await layers.cleanup();
    if (args.layer) {
      await layers.deploy(args.layer);
    } else {
      await layers.deployAll();
    }
  })
  .command('functions list', 'Show all functions.')
  .action(async (args, options, logger) => {
    logger.info(`[List Function]`);
    const functions = await newFunctions(args.env, options, logger);
    await functions.list();
  })
  .command('functions build', 'Build a specific function.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[function]', 'target function to deploy', functionArgValidator)
  .option('--rebuild', 'clean and full build')
  .option('--ignore-profile', 'ignore aws profile')
  .option('--dry-run', 'dry-run ')
  .action(async (args, options, logger) => {
    logger.info(`[Build Function]`);
    const functions = await newFunctions(args.env, options, logger);
    await functions.cleanup();
    if (args.function) {
      const funcPath = utils.toFunctionPath(args.function);
      await functions.buildFunction(funcPath);
    } else {
      await functions.buildAll();
    }
  })
  .command('functions deploy', 'Deploy a specific function.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[function]', 'target function to deploy', functionArgValidator)
  .option('--rebuild', 'clean and full build')
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deployment Function]`);
    const functions = await newFunctions(args.env, options, logger);
    await functions.cleanup();
    if (args.function) {
      const funcPath = utils.toFunctionPath(args.function);
      await functions.deployFunction(funcPath);
    } else {
      await functions.deployAll();
    }
  })
  .command('functions invoke', 'Invoke a specific function.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('<function>', 'target function to invoke', functionArgValidator)
  .option('--event <event>', 'input payload file')
  .option('--vars <params>', 'override payload variables')
  .option('--alias <alias_name>', 'Alias name of function.', ['current', 'stable'])
  .option('--tail', 'output trail log')
  .option('--json', 'output JSON only')
  .action(async (args, options, logger) => {
    if (options.json) changeLogLevel(logger, 'warn');
    logger.info(`[Invoke Function]`);
    const extraVars = getExtraVars(options);
    const functions = await newFunctions(args.env, options, logger);
    const result = await functions.invokeFunction(utils.toFunctionPath(args.function), extraVars, options.event);
    if (options.json) {
      changeLogLevel(logger, 'info');
      logger.info(JSON.stringify(result, null, 2));
    }
  })
  .command('functions publish', 'Publish function.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[function]', 'target function to deploy', functionArgValidator)
  .option('--alias-name <value>', 'Alias name to publish.', ['current', 'stable'], 'current')
  // .option('--force', 'force to publish as new version')
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Publish Function]`);
    const functions = await newFunctions(args.env, options, logger);
    const alias = options.aliasName;
    if (args.function) {
      await functions.publish(utils.toFunctionPath(args.function), alias);
    } else {
      await functions.publishAll(alias);
    }
  })
  .command('logs functions', 'create or update CloudWatch Log Group for Lambda functions.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[function]', 'target function to deploy', functionArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Update CloudWatch Log Groups]`);
    const logs = await newLogs(args.env, options, logger);
    if (args.function) {
      await logs.update(utils.toFunctionPath(args.function));
    } else {
      await logs.updateAll();
    }
  })
  .command('logs subscription', 'subscribe log handler.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[function]', 'target function to deploy', functionArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Update CloudWatch Log Groups]`);
    const logs = await newLogs(args.env, options, logger);
    if (args.function) {
      await logs.subscribe(utils.toFunctionPath(args.function));
    } else {
      await logs.subscribeAll();
    }
  })
  .command('api doc', 'Make APIs document')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[api]', 'target api to make document', apiArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Document API]`);
    const apis = await newApis(args.env, options, logger);
    await apis.cleanup();
    if (args.api) {
      await apis.makeDocument(args.api);
    } else {
      await apis.makeDocumentAll();
    }
  })
  .command('api deploy', 'Deploy APIs')
  .argument('<env>', 'Enviroment', envArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy API]`);
    const apis = await newApis(args.env, options, logger);
    await apis.cleanup();
    await apis.deploy();
  })
  .command('api stage', "Deploy API's stage.")
  .argument('<env>', 'Enviroment', envArgValidator)
  .option('--stage-name <value>', 'Stage name for deployment.', ['current', 'stable'], 'current')
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy API Stage]`);
    const apis = await newApis(args.env, options, logger);
    await apis.cleanup();
    await apis.deployApiStages(options.stageName);
  })
  .command('websockets deploy', 'Deploy WebSocket APIs')
  .argument('<env>', 'Enviroment', envArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy WebSocket API]`);
    const websockets = await newWebSocketApis(args.env, options, logger);
    await websockets.cleanup();
    await websockets.deploy();
  })
  .command('websockets stage', "Deploy WebSocket　API's stage.")
  .argument('<env>', 'Enviroment', envArgValidator)
  .option('--stage-name <value>', 'Stage name for deployment.', ['current', 'stable'], 'current')
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy WebSocket　API Stage]`);
    const websockets = await newWebSocketApis(args.env, options, logger);
    await websockets.cleanup();
    await websockets.deployApiStages(options.stageName);
  })
  .command('stepfunctions deploy', 'Deploy Step Functions')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('[name]', 'target state machine to deploy', stateMachineArgValidator)
  .option('--ignore-profile', 'ignore aws profile')
  .action(async (args, options, logger) => {
    logger.info(`[Deploy Step Function]`);
    const stateMachine = await newStateMachines(args.env, options, logger);
    if (args.name) {
      await stateMachine.deploy(args.name);
    } else {
      await stateMachine.deployAll();
    }
  })
  .command('stepfunctions invoke', 'Invoke a specific step function.')
  .argument('<env>', 'Enviroment', envArgValidator)
  .argument('<name>', 'target step function to invoke', stateMachineArgValidator)
  .option('--event <event>', 'input payload file')
  .option('--vars <params>', 'override payload variables')
  .action(async (args, options, logger) => {
    if (options.json) changeLogLevel(logger, 'warn');
    logger.info(`[Invoke Step Function]`);
    const extraVars = getExtraVars(options);
    const stateMachine = await newStateMachines(args.env, options, logger);
    await stateMachine.startExecution(args.name, extraVars, options.event);
  })  
;
prog.parse(process.argv);
