#!/usr/bin/env node

const swcRegister = require("@swc/register");
const path = require("node:path");
const createIds = require("./create-ids");
const createKeys = require("./create-keys");

const swcOptions = {
  sourceMaps: "inline",
  jsc: {
    parser: {
      syntax: "typescript",
      tsx: true,
    },
    paths: undefined,
    baseUrl: undefined,
  },
  module: {
    type: "commonjs",
  },
  ignore: [
    /.*\/node_modules\/.*/, // parse everything besides files within node_modules
  ],
};

swcRegister(swcOptions);

const configPath = path.join(process.cwd(), "src", "storyflow.config.ts");
const config = require(configPath).default;

const runCommand = (command) => {
  if (command === "dev") {
    createIds(config);
  } else if (command === "build") {
    createIds(config);
  } else if (command === "keys") {
    createKeys(config);
  } else {
    throw new Error(
      `Command "storyflow ${command}" does not exist. You can use "dev", "build", or "keys" instead.\n\n`
    );
  }
};

runCommand(process.argv[2]);
