import { Client } from "../client";
import {
  ComputationRecord,
  DocumentConfig,
  DocumentId,
  FieldConfig,
  NestedDocumentId,
} from "@storyflow/backend/types";
import {
  getDocumentId,
  isNestedDocumentId,
  replaceDocumentId,
} from "@storyflow/backend/ids";
import { fetchArticle } from "./index";
import { getComputationEntries } from "shared/computation-tools";
import { tools } from "shared/editor-tools";

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
  const replaceIds = new Map<
    DocumentId | NestedDocumentId,
    DocumentId | NestedDocumentId
  >();

  const doc = await fetchArticle(templateId, options.client);

  if (doc) {
    let record: ComputationRecord = Object.fromEntries(
      getComputationEntries(doc.record).map(([key, value]) => {
        if (getDocumentId(key) === doc._id) {
          replaceIds.set(doc._id, newDocumentId);

          const newValue = value.map((el) => {
            if (
              typeof el === "object" &&
              el !== null &&
              "id" in el &&
              isNestedDocumentId(el.id)
            ) {
              const newNestedDocumentId =
                options.generateDocumentId(newDocumentId);
              replaceIds.set(el.id, newNestedDocumentId);
              return {
                ...el,
                id: newNestedDocumentId,
              };
            }
            return el;
          });

          return [key, newValue];
        }
        return [key, value];
      })
    );

    record = Object.fromEntries(
      getComputationEntries(doc.record).map(([key, value]) => {
        const newKey = replaceIds.has(getDocumentId(key))
          ? replaceDocumentId(key, replaceIds.get(getDocumentId(key))!)
          : key;

        const newValue = value.map((el) => {
          if (
            tools.isNestedField(el) &&
            replaceIds.has(getDocumentId(el.field))
          ) {
            return {
              ...el,
              field: replaceDocumentId(
                el.field,
                replaceIds.get(getDocumentId(el.field))!
              ),
            };
          }
          return el;
        });

        return [newKey, newValue];
      })
    );

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
