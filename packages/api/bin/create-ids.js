const path = require("node:path");
const fs = require("node:fs");

module.exports = function createIds(config) {
  const filePath = path.join(process.cwd(), "./storyflow-ids.json");

  let ids = [];

  try {
    ids = require(filePath);
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

  fs.writeFileSync(filePath, JSON.stringify(ids));
};
