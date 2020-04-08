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
;
prog.parse(process.argv);
