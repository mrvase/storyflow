import {
  createDocumentId,
  createFieldId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getIdFromString,
  getRawFieldId,
  getRawFolderId,
} from "@storyflow/cms/ids";
import {
  DBDocument,
  DBFolder,
  DBFolderRecord,
  SpaceId,
  SyntaxTreeRecord,
} from "@storyflow/cms/types";
import {
  Collection,
  DocumentId,
  FieldId,
  FolderId,
  StoryflowConfig,
  TemplateFields,
} from "@storyflow/shared/types";
import path from "path";
import fs from "fs";
import { DEFAULT_SYNTAX_TREE, TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { modifyKeys, modifyObject } from "../utils";

let ids: (string | [id: string, ...fields: string[]])[] | null = null;

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

const getCustomFolderId = (name: string) => {
  const ids = getIdConfig();
  const index = ids.findIndex((el) => typeof el === "string" && el === name);
  if (index === -1) {
    throw new Error(
      `Missing folder id for "${name}". It is likely that Storyflow has not been preconfigured.`
    );
  }
  const number = TEMPLATE_OFFSET - index;
  return createDocumentId(number) as unknown as FolderId;
};

export const getCustomTemplateIds = (name: string) => {
  const ids = getIdConfig();
  const index = ids.findIndex((el) => Array.isArray(el) && el[0] === name);
  if (index === -1) {
    throw new Error(
      `Missing template id for "${name}". It is likely that Storyflow has not been preconfigured.`
    );
  }
  const number = TEMPLATE_OFFSET - index;
  const _id = createDocumentId(number);
  const fieldData = (ids[index] as string[]).slice(1);
  const fieldIds = Object.fromEntries(
    fieldData.map((el, index) => [el, createFieldId(index, _id)])
  );
  const fieldNames = modifyObject(fieldIds, ([key, value]) => [
    getRawFieldId(value),
    key,
  ]);
  return {
    _id,
    fieldIds,
    fieldNames,
  };
};

export const convertCollectionToFolder = (collection: Collection): DBFolder => {
  const _id = getCustomFolderId(collection.name);
  return {
    _id,
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
    ...(collection.template && {
      template: getCustomTemplateIds(collection.name)._id,
    }),
    domains: [],
  };
};

export const convertTemplateToDocument = ({
  name,
  label,
  fields,
}: {
  name: string;
  label: string;
  fields: TemplateFields;
}): DBDocument => {
  const { _id, fieldIds } = getCustomTemplateIds(name);

  return {
    _id,
    folder: TEMPLATE_FOLDER,
    config: fields.map((el) => ({ id: fieldIds[el.name], ...el })),
    versions: {
      config: [0],
    },
    record: {
      [createTemplateFieldId(_id, DEFAULT_FIELDS.template_label.id)]: {
        ...DEFAULT_SYNTAX_TREE,
        children: [label],
      },
    },
  };
};

export const convertDataToRecord = (
  data: any,
  collection: Collection,
  documentId: DocumentId
) => {
  if (!collection.template) {
    throw new Error(
      `Collection "${collection.name}" does not have a template.`
    );
  }
  const { fieldIds } = getCustomTemplateIds(collection.name);
  const record: SyntaxTreeRecord = {};

  collection.template.forEach(({ name, useAsTitle }) => {
    const id = createTemplateFieldId(documentId, fieldIds[name]);
    const value = { ...DEFAULT_SYNTAX_TREE, children: [data[name]] };
    record[id] = value;
    if (useAsTitle) {
      const id = createTemplateFieldId(documentId, DEFAULT_FIELDS.label.id);
      record[id] = value;
    }
  });

  return record;
};

export const convertRecordToData = (
  record: SyntaxTreeRecord,
  collection: Collection
) => {
  if (!collection.template) {
    throw new Error(
      `Collection "${collection.name}" does not have a template.`
    );
  }

  const template = collection.template ?? [];

  const { fieldIds } = getCustomTemplateIds(collection.name);

  const rawRecord = modifyKeys(record, (key) => getRawFieldId(key));

  const data = Object.fromEntries(
    collection.template.map(({ name }) => {
      const id = fieldIds[name];
      const defaults = {
        string: "",
        number: 0,
        boolean: false,
        date: new Date().toISOString(),
      };
      const field = template.find((el) => el.name === name);
      const type = field?.type as keyof typeof defaults;
      const rawId = createRawTemplateFieldId(id);
      if (field?.isArray) {
        return [name, rawRecord[rawId]?.children ?? []];
      }
      return [name, rawRecord[rawId]?.children?.[0] ?? defaults[type] ?? null];
    })
  );
  return data;
};

export const convertDataToDocument = (
  data: any,
  collection: Collection,
  index?: number
): DBDocument => {
  if (!collection.template) {
    throw new Error(
      `Collection "${collection.name}" does not have a template.`
    );
  }
  const folder = getCustomFolderId(collection.name);

  const _id = `${getIdFromString(collection.name)}${createDocumentId(
    256 ** 2 + (index ?? 0)
  ).slice(12)}` as DocumentId;

  const record = convertDataToRecord(data, collection, _id);

  return {
    _id,
    folder,
    config: [],
    versions: {
      config: [0],
    },
    record,
  };
};

export const createRecordToDocumentMapFn =
  (collection: Collection) =>
  (dataRecord: Record<string, any>, index: number): DBDocument => {
    return convertDataToDocument(dataRecord, collection, index);
  };

export const getCustomTemplates = (config: StoryflowConfig) => {
  const documents: DBDocument[] = [];
  if (config.templates) {
    config.templates.forEach((template) => {
      documents.push(convertTemplateToDocument(template));
    });
  }

  if (config.collections) {
    config.collections.forEach((collection) => {
      if (!collection.template) return;
      documents.push(
        convertTemplateToDocument({
          name: collection.name,
          label: collection.label,
          fields: collection.template,
        })
      );
    });
  }

  return documents;
};

export const getCustomFolders = (config: StoryflowConfig) => {
  const record: DBFolderRecord = {};

  if (config.collections) {
    for (const collection of config.collections) {
      const folder = convertCollectionToFolder(collection);
      record[getRawFolderId(folder._id)] = folder;
    }
  }

  return record;
};

export const getCustomCollection = (id: FolderId, config: StoryflowConfig) => {
  return config.collections?.find((el) => getCustomFolderId(el.name) === id);
};

export const getCustomCollectionFromField = (
  id: FieldId,
  config: StoryflowConfig
) => {
  const prefixId = id.slice(0, 12);
  if (prefixId === "000000000000") return;
  return config.collections?.find(
    (el) => getIdFromString(el.name) === prefixId
  );
};
