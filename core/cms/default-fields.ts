import { DEFAULT_SYNTAX_TREE } from "./constants";
import {
  createDocumentId,
  createFieldId,
  getTemplateDocumentId,
  SYSTEM_COMPOUND_TEMPLATE_OFFSET,
  SYSTEM_TEMPLATE_OFFSET,
} from "./ids";
import { insertRootInTransforms } from "./transform";
import type { FieldId } from "@storyflow/shared/types";
import type { DefaultFieldConfig, FieldConfig } from "./types";

let index1 = 0;
const generateTemplateFieldId = () => {
  return createFieldId(0, createDocumentId(SYSTEM_TEMPLATE_OFFSET + index1++));
};

let index2 = 0;
export const generateTemplateId = () => {
  return createDocumentId(SYSTEM_COMPOUND_TEMPLATE_OFFSET + index2++);
};

export const DEFAULT_FIELDS = {
  creation_date: {
    id: generateTemplateFieldId(),
    label: "Oprettelsesdato",
  },
  label: {
    id: generateTemplateFieldId(),
    label: "Label",
  },
  url: {
    id: generateTemplateFieldId(),
    ui: "url",
    label: "URL",
    initialValue: {
      transforms: [
        {
          type: "url",
        },
      ],
      children: ["", "/", ""],
    },
  },
  slug: {
    id: generateTemplateFieldId(),
    label: "URL-segment",
    initialValue: {
      transforms: [
        {
          type: "slug",
        },
      ],
    },
  },
  page: {
    id: generateTemplateFieldId(),
    label: "Side",
    type: "children",
  },
  layout: {
    id: generateTemplateFieldId(),
    label: "Layout",
    type: "children",
  },
  redirect: {
    id: generateTemplateFieldId(),
    label: "Omdirigering",
  },
  published: {
    id: generateTemplateFieldId(),
    label: "Offentlig",
    type: "boolean",
  },
  released: {
    id: generateTemplateFieldId(),
    label: "Udgivelsesdato",
    type: "date",
  },
  user: {
    id: generateTemplateFieldId(),
    label: "Brugeremail",
  },
  params: {
    id: generateTemplateFieldId(),
    label: "URL-segmenter",
  },
  template_label: {
    id: generateTemplateFieldId(),
    label: "Label til template",
  },
  og_image: {
    id: generateTemplateFieldId(),
    label: "Open Graph-billede",
    type: "children",
  },
  seo_title: {
    id: generateTemplateFieldId(),
    label: "SEO-titel",
  },
  seo_description: {
    id: generateTemplateFieldId(),
    label: "SEO-beskrivelse",
  },
} satisfies Record<string, DefaultFieldConfig>;

export const getDefaultValue = (field: DefaultFieldConfig) => {
  if (!field.initialValue) return DEFAULT_SYNTAX_TREE;
  const root = {
    ...DEFAULT_SYNTAX_TREE,
    children: field.initialValue.children ?? [],
  };
  return field.initialValue.transforms
    ? insertRootInTransforms(root, field.initialValue.transforms)
    : root;
};

export function isDefaultField(
  id: FieldId,
  label: keyof typeof DEFAULT_FIELDS
): boolean {
  return (
    getTemplateDocumentId(DEFAULT_FIELDS[label].id) ===
    getTemplateDocumentId(id)
  );
}

export function getDefaultField(
  id: FieldId
): Omit<FieldConfig, "id"> | undefined {
  return Object.values(DEFAULT_FIELDS).find((value) => {
    return getTemplateDocumentId(value.id) === getTemplateDocumentId(id);
  });
}
