import { Client } from "../client";
import {
  ComputationBlock,
  DBDocument,
  DocumentConfig,
  DocumentId,
  FieldConfig,
  ValueRecord,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { computeFieldId } from "@storyflow/backend/ids";
import { TEMPLATES } from "@storyflow/backend/templates";
import { fetchArticle } from "./index";

export const getDefaultValuesFromTemplateAsync = async (
  id: DocumentId,
  client: Client
) => {
  const values: ValueRecord<TemplateFieldId> = {};
  const compute: ComputationBlock[] = [];

  const getValues = async (id: DocumentId) => {
    const assignValues = (doc: Pick<DBDocument, "compute" | "values">) => {
      const computeIds = new Set();
      doc.compute.forEach((block) => {
        computeIds.add(block.id);
        const exists = compute.some(({ id }) => id === block.id);
        // we handle external imports on the server
        if (block.id.startsWith(id) && !exists) {
          compute.push(block);
        }
      });
      Object.assign(
        values,
        Object.fromEntries(
          Object.entries(doc.values).filter(
            ([key]) =>
              !computeIds.has(computeFieldId(id, key as TemplateFieldId))
          )
        )
      );
    };

    /*
    const defaultTemplate = TEMPLATES.find((el) => el.id === id);
    if (defaultTemplate) {
      assignValues(article);
      return;
    }
    */
    const article = await fetchArticle(id, client);

    if (article) {
      console.log("default article", article);
      assignValues(article);

      /*
      const nestedTemplates = article.config
        .filter((el): el is TemplateRef => "template" in el)
        .map((el) => el.template as DocumentId);
      nestedTemplates.forEach((id) => getValues(id));
      */
    }
  };
  await getValues(id);

  return { values, compute };
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
          const defaultTemplate = TEMPLATES.find((dt) => dt.id === el.template);
          if (defaultTemplate) {
            return getFields(defaultTemplate.config);
          }
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
