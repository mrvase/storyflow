import { Client } from "../client";
import {
  TreeRecord,
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
import { fetchArticle } from "./index";
import { getComputationEntries, isSyntaxTree } from "shared/computation-tools";
import { tokens } from "@storyflow/backend/tokens";

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
  const newNestedIds = new Map<RawDocumentId, NestedDocumentId>();

  const doc = await fetchArticle(templateId, options.client);

  if (doc) {
    const getNewKey = (key: FieldId) => {
      if (getDocumentId(key) !== doc._id) return key;
      return createTemplateFieldId(newDocumentId, key);
    };

    let record: TreeRecord = Object.fromEntries(
      getComputationEntries(doc.record).map(([key, value]) => {
        const newKey = getNewKey(key);

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
                const newNestedId = options.generateDocumentId(newDocumentId);
                newNestedIds.set(getRawDocumentId(token.id), newNestedId);
                const newToken = { ...token };
                newToken.id = newNestedId;
                if (
                  "field" in newToken &&
                  getDocumentId(newToken.field) === doc._id
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

    record = Object.fromEntries(
      getComputationEntries(record).map(([key, value]) => {
        const raw = getRawDocumentId(getDocumentId(key));
        const newKey = newNestedIds.has(raw)
          ? replaceDocumentId(key, newNestedIds.get(raw)!)
          : key;

        return [newKey, value];
      })
    );

    /*
    record = Object.fromEntries(
      getComputationEntries(record).map(([key, value]) => {
        const raw = getRawDocumentId(getDocumentId(key));
        const newKey = replaceIds.has(raw)
          ? replaceDocumentId(key, replaceIds.get(raw)!)
          : key;

        const newValue = value.map((el) => {
          if (
            symb.isNestedField(el) &&
            replaceIds.has(getRawDocumentId(getDocumentId(el.field)))
          ) {
            return {
              ...el,
              field: replaceDocumentId(
                el.field,
                replaceIds.get(getRawDocumentId(getDocumentId(el.field)))!
              ),
            };
          }
          return el;
        });

        return [newKey, newValue];
      })
    );
    */

    return record;
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
          /*
          const defaultTemplate = TEMPLATES.find((dt) => dt.id === el.template);
          if (defaultTemplate) {
            return getFields(defaultTemplate.config);
          }
          */
          const article = await fetchArticle(el.template, client);
          if (!article) return [];
          return await getFields(article.config);
        }
        return [];
      })
    ).then((el) => el.flat(1));
  };

  return await getFields(template);
};
