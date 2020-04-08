#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const fs = require('fs');
const prog = require('caporal');
const { newLayers, newFunctions } = require('../lib/Cappuccinos');
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
;
prog.parse(process.argv);
