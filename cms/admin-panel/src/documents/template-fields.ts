import { Client } from "../client";
import {
  SyntaxTreeRecord,
  DocumentConfig,
  DocumentId,
  FieldConfig,
  FieldId,
  NestedDocumentId,
  RawDocumentId,
  SyntaxTree,
} from "@storyflow/backend/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  getRawDocumentId,
  isNestedDocumentId,
  replaceDocumentId,
} from "@storyflow/backend/ids";
import { fetchDocument } from "./index";
import { getSyntaxTreeEntries } from "shared/computation-tools";
import { isSyntaxTree } from "@storyflow/backend/syntax-tree";
import { tokens } from "@storyflow/backend/tokens";

export const copyRecord = (
  originalRecord: SyntaxTreeRecord,
  options: {
    oldDocumentId: DocumentId;
    newDocumentId: DocumentId;
    generateNestedDocumentId: () => NestedDocumentId;
    generateTemplateFieldId?: (key: FieldId) => FieldId;
  }
) => {
  const newNestedIds = new Map<RawDocumentId, NestedDocumentId>();

  const getNewNestedId = (oldRaw: RawDocumentId) => {
    const existing = newNestedIds.get(oldRaw);
    if (existing) return existing;
    const newId = options.generateNestedDocumentId();
    newNestedIds.set(oldRaw, newId);
    return newId;
  };

  const getNewKey = (key: FieldId) => {
    if (getDocumentId(key) !== options.oldDocumentId) return key;
    return options.generateTemplateFieldId!(key);
  };

  let record: SyntaxTreeRecord = Object.fromEntries(
    getSyntaxTreeEntries(originalRecord).map(([key, value]) => {
      // fix template field ids
      let newKey = key;

      if (
        options.generateTemplateFieldId &&
        getDocumentId(key) === options.oldDocumentId
      ) {
        newKey = getNewKey(key);
      }

      const modifyNode = (node: SyntaxTree): SyntaxTree => {
        return {
          ...node,
          children: node.children.map((token) => {
            if (isSyntaxTree(token)) {
              const newToken = { ...token };
              if (newToken.type === "loop") {
                newToken.data = getRawDocumentId(getNewNestedId(token.data!));
                console.log("FOUND LOOP", token, newToken);
              }
              return modifyNode(newToken);
            } else if (
              tokens.isNestedEntity(token) &&
              isNestedDocumentId(token.id)
            ) {
              const newNestedId = getNewNestedId(getRawDocumentId(token.id));
              const newToken = { ...token };
              newToken.id = newNestedId;

              // replace references to the old template fields with references to the new ones
              if (
                options.generateTemplateFieldId &&
                "field" in newToken &&
                getDocumentId(newToken.field) === options.oldDocumentId
              ) {
                newToken.field = getNewKey(newToken.field);
              } else if (
                "field" in newToken &&
                newToken.field.endsWith(getIdFromString("data"))
              ) {
                newToken.field = replaceDocumentId(
                  newToken.field,
                  getNewNestedId(
                    getRawDocumentId(getDocumentId(newToken.field))
                  )
                );
              }

              return newToken;
            }
            return token;
          }),
        };
      };

      const newValue = modifyNode(value);

      return [newKey, newValue];
    })
  );

  // fix nested record keys
  record = Object.fromEntries(
    getSyntaxTreeEntries(record).map(([key, value]) => {
      const parentId = getDocumentId(key);
      const raw = getRawDocumentId(parentId);
      let newKey = key;

      if (newNestedIds.has(raw)) {
        newKey = replaceDocumentId(key, newNestedIds.get(raw)!);
      }

      return [newKey, value];
    })
  );
  return record;
};

export const getDefaultValuesFromTemplateAsync = async (
  newDocumentId: DocumentId,
  templateId: DocumentId,
  options: {
    client: Client;
    generateDocumentId: {
      (): DocumentId;
      (parent: DocumentId): NestedDocumentId;
    };
  }
) => {
  const doc = await fetchDocument(templateId, options.client);

  if (doc) {
    return copyRecord(doc.record, {
      oldDocumentId: doc._id,
      newDocumentId,
      generateNestedDocumentId: () => options.generateDocumentId(newDocumentId),
      generateTemplateFieldId: (key) =>
        createTemplateFieldId(newDocumentId, key),
    });
  }

  return {};
};

export const getTemplateFieldsAsync = async (
  template: DocumentConfig,
  client: Client
) => {
  const templates = new Set();

  const getFields = async (
    template: DocumentConfig
  ): Promise<FieldConfig[]> => {
    return await Promise.all(
      template.map(async (el) => {
        if (Array.isArray(el)) {
          return el;
        } else if ("id" in el) {
          return [el];
        } else if ("template" in el && !templates.has(el.template)) {
          templates.add(el.template);
          const doc = await fetchDocument(el.template, client);
          if (!doc) return [];
          return await getFields(doc.config);
        }
        return [];
      })
    ).then((el) => el.flat(1));
  };

  return await getFields(template);
};
