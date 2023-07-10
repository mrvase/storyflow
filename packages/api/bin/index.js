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

  let ids = [];

  try {
    ids = require(filename);
  } catch (err) {
    console.log("No id file exists. Will create file");
  }

  config.collections.forEach((coll) => {
    const folderExists = ids.some(
      (el) => typeof el === "string" && el === coll.name
    );
    if (!folderExists) {
      ids.push(coll.name);
    }
    if (coll.template) {
      const template = ids.find(
        (el) => Array.isArray(el) && el[0] === coll.name
      );
      if (template) {
        coll.template.forEach((field) => {
          const fieldExists = template.some(
            (el, index) => index > 0 && el === field.name
          );
          if (!fieldExists) {
            template.push(field.name);
          }
        });
      } else {
        ids.push([coll.name, ...coll.template.map((field) => field.name)]);
      }
    }
  });

  fs.writeFileSync(filename, JSON.stringify(ids));
}

createIds();
