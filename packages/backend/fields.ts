import {
  createDocumentId,
  createFieldId,
  getTemplateDocumentId,
  SYSTEM_TEMPLATE_OFFSET,
} from "./ids";
import { FieldConfig, FieldId } from "./types";

/*
const assignIds = <T extends Record<string, any>>(
  fields: T
): { [Key in keyof T]: T[Key] & { id: RawFieldId } } => {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value], index) => [
      key,
      {
        ...value,
        id: getRawFieldId(
          createTemplateFieldId(
            createDocumentId(0), // is removed again
            createFieldId(0, createDocumentId(SYSTEM_TEMPLATE_OFFSET + index))
          )
        ),
      },
    ])
  ) as any;
};
*/

let index = 0;

const generateTemplateId = () => {
  return createDocumentId(SYSTEM_TEMPLATE_OFFSET + index++);
};

const generateTemplateFieldId = () => {
  return createFieldId(0, generateTemplateId());
};

export const DEFAULT_FIELDS = {
  creation_date: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Oprettelsesdato",
  },
  label: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Label",
  },
  url: {
    id: generateTemplateFieldId(),
    type: "url",
    label: "URL",
  },
  slug: {
    id: generateTemplateFieldId(),
    type: "slug",
    label: "URL-segment",
  },
  page: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Side",
  },
  layout: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Layout",
  },
  redirect: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Omdirigering",
  },
  published: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Offentlig",
  },
  released: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Udgivelsesdato",
  },
  user: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "Brugeremail",
  },
  params: {
    id: generateTemplateFieldId(),
    type: "default",
    label: "URL-segmenter",
  },
} as const;

export const DEFAULT_TEMPLATES = {
  staticPage: {
    id: generateTemplateId(),
    label: "Statisk side",
    config: [
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.url.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.layout.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.page.id),
      },
    ],
  },
  dynamicPage: {
    id: generateTemplateId(),
    label: "Dynamisk side",
    config: [
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.url.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.params.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.layout.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.page.id),
      },
    ],
  },
  redirectPage: {
    id: generateTemplateId(),
    label: "Viderestilling",
    config: [
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.url.id),
      },
      {
        template: getTemplateDocumentId(DEFAULT_FIELDS.redirect.id),
      },
    ],
  },
};

export function getDefaultField(
  id: FieldId
): Omit<FieldConfig, "id"> | undefined {
  return Object.values(DEFAULT_FIELDS).find((value) => {
    return getTemplateDocumentId(value.id) === getTemplateDocumentId(id);
  });
}
