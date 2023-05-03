import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import type { DBDocument } from "@storyflow/db-core/types";
import {
  DEFAULT_FIELDS,
  generateTemplateId,
  getDefaultValue,
} from "@storyflow/fields-core/default-fields";
import { TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import { getTemplateDocumentId } from "@storyflow/fields-core/ids";
import type { DefaultFieldConfig } from "@storyflow/fields-core/types";

const generateTemplateFromDefaultFields = (
  label: string,
  fields: DefaultFieldConfig[]
): DBDocument => {
  const record: SyntaxTreeRecord = {};

  fields.forEach((field) => {
    if (field.initialValue) record[field.id] = getDefaultValue(field);
  });

  return {
    _id: generateTemplateId(),
    folder: TEMPLATE_FOLDER,
    label,
    config: fields.map((field) => ({
      template: getTemplateDocumentId(field.id),
    })),
    record,
    versions: { config: [0] },
  };
};

export const DEFAULT_TEMPLATES = {
  staticPage: generateTemplateFromDefaultFields("Statisk side", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.layout,
    DEFAULT_FIELDS.page,
  ]),
  dynamicPage: generateTemplateFromDefaultFields("Dynamisk side", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.params,
    DEFAULT_FIELDS.layout,
    DEFAULT_FIELDS.page,
  ]),
  redirectPage: generateTemplateFromDefaultFields("Viderestilling", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.redirect,
  ]),
};
export const TEMPLATES = [
  ...Object.values(DEFAULT_FIELDS).map((field): DBDocument => {
    let { initialValue, ...fieldConfig } = field as typeof field & {
      initialValue?: any;
    };

    const record: SyntaxTreeRecord = {};
    if ("initialValue" in field) {
      record[field.id] = getDefaultValue(field);
    }

    return {
      _id: getTemplateDocumentId(field.id),
      folder: TEMPLATE_FOLDER,
      label: field.label,
      config: [fieldConfig],
      record,
      versions: { config: [0, 0, ""] },
    };
  }),
  ...Object.values(DEFAULT_TEMPLATES),
];
