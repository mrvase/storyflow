import { createIdFromNumber, getTemplateFieldId } from "./ids";
import {
  DocumentId,
  FieldConfig,
  FieldId,
  FieldType,
  TemplateDocument,
} from "../types";

type BasicFieldRef = { type: FieldType; label: string };

const createTemplate = (
  fields: (BasicFieldRef | BasicFieldRef[])[],
  index: number
): TemplateDocument => {
  const id = createIdFromNumber(index) as DocumentId;
  let i = 0;
  return {
    id,
    values: {},
    compute: [],
    config: fields.map((el) => {
      if (Array.isArray(el)) {
        return el.map((el) => ({
          ...el,
          id: `${id}${id}----${createIdFromNumber(i++)}` as FieldId,
          static: true,
        }));
      }
      return {
        ...el,
        id: `${id}${id}----${createIdFromNumber(i++)}` as FieldId,
        static: true,
      };
    }),
  };
};

const creationDateTemplate: BasicFieldRef[] = [
  {
    type: "default",
    label: "Oprettelsesdato",
  },
];

const labelTemplate: BasicFieldRef[] = [
  {
    type: "default",
    label: "Label",
  },
];

const urlTemplate: BasicFieldRef[] = [
  {
    type: "url",
    label: "URL",
  },
];

const slugTemplate: BasicFieldRef[] = [
  {
    type: "slug",
    label: "Slug",
  },
];

const pageTemplate: (BasicFieldRef | BasicFieldRef[])[] = [
  {
    type: "default",
    label: "Side",
  },
];

const layoutTemplate: (BasicFieldRef | BasicFieldRef[])[] = [
  {
    type: "default",
    label: "Layout",
  },
];

const redirectTemplate: BasicFieldRef[] = [
  {
    type: "url",
    label: "Omdiriger",
  },
];

const publishedTemplate: BasicFieldRef[] = [
  {
    type: "default",
    label: "Offentlig",
  },
];

const releasedTemplate: BasicFieldRef[] = [
  {
    type: "default",
    label: "Udgivelsesdato",
  },
];

const userTemplate: BasicFieldRef[] = [
  {
    type: "default",
    label: "Brugeremail",
  },
];

export const TEMPLATES = [
  creationDateTemplate,
  labelTemplate,
  urlTemplate,
  slugTemplate,
  pageTemplate,
  layoutTemplate,
  redirectTemplate,
  publishedTemplate,
  releasedTemplate,
  userTemplate,
].map(createTemplate);

export const CREATION_DATE_ID = getTemplateFieldId(
  (TEMPLATES[0].config[0] as FieldConfig).id
);
export const LABEL_ID = getTemplateFieldId(
  (TEMPLATES[1].config[0] as FieldConfig).id
);
export const URL_ID = getTemplateFieldId(
  (TEMPLATES[2].config[0] as FieldConfig).id
);
export const SLUG_ID = getTemplateFieldId(
  (TEMPLATES[3].config[0] as FieldConfig).id
);
export const PAGE_ID = getTemplateFieldId(
  (TEMPLATES[4].config[0] as FieldConfig).id
);
export const LAYOUT_ID = getTemplateFieldId(
  (TEMPLATES[5].config[0] as FieldConfig).id
);
export const REDIRECT_ID = getTemplateFieldId(
  (TEMPLATES[6].config[0] as FieldConfig).id
);
export const PUBLISHED_ID = getTemplateFieldId(
  (TEMPLATES[7].config[0] as FieldConfig).id
);
export const RELEASED_ID = getTemplateFieldId(
  (TEMPLATES[8].config[0] as FieldConfig).id
);
export const USER_ID = getTemplateFieldId(
  (TEMPLATES[9].config[0] as FieldConfig).id
);
