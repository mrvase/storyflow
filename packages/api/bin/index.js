#!/usr/bin/env node

const swcRegister = require("@swc/register");
const path = require("path");
const fs = require("fs");

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

function createIds() {
  const filename = path.join(process.cwd(), "./storyflow-ids.json");

  let current = [];

  try {
    current = require(filename);
  } catch (err) {
    console.log("No id file exists. Will create file");
  }

  let next = [];

  if (current) {
    next = current;
  }

  const add = config.collections
    .filter(
      ({ name }) => !current.some(([existingName]) => existingName === name)
    )
    .map((el) => [el.name]);

  next = next.concat(add);

  fs.writeFileSync(filename, JSON.stringify(next));
}

createIds();
