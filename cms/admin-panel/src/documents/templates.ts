import type { SyntaxTreeRecord } from "@storyflow/cms/types";
import type { DBDocument } from "@storyflow/cms/types";
import {
  DEFAULT_FIELDS,
  generateTemplateId,
  getDefaultValue,
} from "@storyflow/cms/default-fields";
import { DEFAULT_SYNTAX_TREE, TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import {
  createTemplateFieldId,
  getDocumentId,
  getTemplateDocumentId,
} from "@storyflow/cms/ids";
import type { DefaultFieldConfig } from "@storyflow/cms/types";
import { DocumentId } from "@storyflow/shared/types";

const generateTemplateFromDefaultFields = (
  label: string,
  fields: DefaultFieldConfig[]
): DBDocument => {
  const record: SyntaxTreeRecord = {};

  const _id = generateTemplateId();

  fields.forEach((field) => {
    if (field.initialValue)
      record[createTemplateFieldId(_id, field.id)] = getDefaultValue(field);
  });

  record[createTemplateFieldId(_id, DEFAULT_FIELDS.template_label.id)] = {
    ...DEFAULT_SYNTAX_TREE,
    children: [label],
  };

  return {
    _id,
    folder: TEMPLATE_FOLDER,
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
    DEFAULT_FIELDS.seo_title,
    DEFAULT_FIELDS.seo_description,
    DEFAULT_FIELDS.og_image,
  ]),
  dynamicPage: generateTemplateFromDefaultFields("Dynamisk side", [
    DEFAULT_FIELDS.url,
    DEFAULT_FIELDS.params,
    DEFAULT_FIELDS.layout,
    DEFAULT_FIELDS.page,
    DEFAULT_FIELDS.seo_title,
    DEFAULT_FIELDS.seo_description,
    DEFAULT_FIELDS.og_image,
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

    // default fields are the zeroth field in their own template document
    // so we just get the document id
    const _id = getDocumentId<DocumentId>(field.id);

    const record: SyntaxTreeRecord = {};
    if ("initialValue" in field) {
      record[field.id] = getDefaultValue(field);
    }

    // this is external to the field
    record[createTemplateFieldId(_id, DEFAULT_FIELDS.template_label.id)] = {
      ...DEFAULT_SYNTAX_TREE,
      children: [field.label],
    };

    return {
      _id,
      folder: TEMPLATE_FOLDER,
      config: [fieldConfig],
      record,
      versions: { config: [0, 0, ""] },
    };
  }),
  ...Object.values(DEFAULT_TEMPLATES),
];
