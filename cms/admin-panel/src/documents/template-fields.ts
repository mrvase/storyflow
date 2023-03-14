import { Client } from "../client";
import {
  ComputationRecord,
  DocumentConfig,
  DocumentId,
  FieldConfig,
  FieldId,
  NestedDocumentId,
  RawDocumentId,
} from "@storyflow/backend/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawDocumentId,
  isNestedDocumentId,
  isTemplateField,
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
  const newNestedIds = new Map<RawDocumentId, NestedDocumentId>();

  const doc = await fetchArticle(templateId, options.client);

  if (doc) {
    const getNewKey = (key: FieldId) => {
      if (getDocumentId(key) !== doc._id) return key;
      return createTemplateFieldId(newDocumentId, key);
    };

    let record: ComputationRecord = Object.fromEntries(
      getComputationEntries(doc.record).map(([key, value]) => {
        const newKey = getNewKey(key);

        const newValue = value.map((el) => {
          if (
            typeof el === "object" &&
            el !== null &&
            "id" in el &&
            isNestedDocumentId(el.id)
          ) {
            const newNestedId = options.generateDocumentId(newDocumentId);
            newNestedIds.set(getRawDocumentId(el.id), newNestedId);
            const newEl = { ...el };
            newEl.id = newNestedId;
            if ("field" in newEl && getDocumentId(newEl.field) === doc._id) {
              newEl.field = getNewKey(newEl.field);
            }
            return newEl;
          }
          return el;
        });

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
            tools.isNestedField(el) &&
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
