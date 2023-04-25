import { DEFAULT_SYNTAX_TREE, TEMPLATE_FOLDER } from "./constants";
import {
  createDocumentId,
  createFieldId,
  getTemplateDocumentId,
  SYSTEM_TEMPLATE_OFFSET,
} from "./ids";
import { insertRootInTransforms } from "./transform";
import type { FieldId } from "@storyflow/shared/types";
import type { DefaultFieldConfig, FieldConfig } from "./types";

let index = 0;

export const generateTemplateId = () => {
  return createDocumentId(SYSTEM_TEMPLATE_OFFSET + index++);
};

const generateTemplateFieldId = () => {
  return createFieldId(0, generateTemplateId());
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
    type2: "children",
  },
  layout: {
    id: generateTemplateFieldId(),
    label: "Layout",
    type2: "children",
  },
  redirect: {
    id: generateTemplateFieldId(),
    label: "Omdirigering",
  },
  published: {
    id: generateTemplateFieldId(),
    label: "Offentlig",
  },
  released: {
    id: generateTemplateFieldId(),
    label: "Udgivelsesdato",
  },
  user: {
    id: generateTemplateFieldId(),
    label: "Brugeremail",
  },
  params: {
    id: generateTemplateFieldId(),
    label: "URL-segmenter",
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
