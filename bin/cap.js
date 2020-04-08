#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const fs = require('fs');
const prog = require('caporal');
const { newLayers } = require('../lib/Cappuccinos');

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

;
prog.parse(process.argv);
