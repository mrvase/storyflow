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
              return modifyNode(token);
            } else if (
              tokens.isNestedEntity(token) &&
              isNestedDocumentId(token.id)
            ) {
              const newNestedId = options.generateNestedDocumentId();

              newNestedIds.set(getRawDocumentId(token.id), newNestedId);
              const newToken = { ...token };

              newToken.id = newNestedId;

              // replace references to the old template fields with references to the new ones
              if (
                options.generateTemplateFieldId &&
                "field" in newToken &&
                getDocumentId(newToken.field) === options.oldDocumentId
              ) {
                newToken.field = getNewKey(newToken.field);
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
          const article = await fetchDocument(el.template, client);
          if (!article) return [];
          return await getFields(article.config);
        }
        return [];
      })
    ).then((el) => el.flat(1));
  };

  return await getFields(template);
};
