import { createDocumentId, getIdFromString } from "@storyflow/cms/ids";
import { DBFolder, SpaceId } from "@storyflow/cms/types";
import { Collection, FieldId, FolderId } from "@storyflow/shared/types";
import path from "path";
import fs from "fs";

let ids: [id: string, fields?: []][] | null = null;

const getIdConfig = () => {
  const idsPath = path.join(process.cwd(), "storyflow-ids.json");
  if (ids) return ids;
  try {
    const string = fs.readFileSync(idsPath).toString();
    console.log("STRING", string);
    ids = JSON.parse(string);
    console.log("IDS", ids);
  } catch (err) {
    console.log(err);
    ids = [];
  }
  return ids!;
};

const TEMPLATE_OFFSET = 256 ** 2 - 1;

const getCustomDocumentId = (name: string) => {
  const ids = getIdConfig();
  const index = ids.findIndex((el) => el[0] === name);
  if (index === -1) {
    throw new Error("Storyflow has not been preconfigured.");
  }
  const number = TEMPLATE_OFFSET - index;
  return createDocumentId(number);
};

export const getCustomTemplates = () => {};

export const getFolderFromCollection = (collection: Collection): DBFolder => {
  console.log(getCustomDocumentId("mailchimp"));
  return {
    _id: `${getIdFromString(collection.name)}000000000000` as FolderId,
    label: collection.label,
    spaces: [
      {
        id: Math.random().toString().slice(2, 10) as SpaceId,
        type: "documents",
      },
    ],
    /*
    template: collection.fields.map((field) => ({
      id: `000000000000${getIdFromString(field.name)}` as FieldId,
      ...field,
    })),
    */
    domains: [],
  };
};
