import { DEFAULT_SYNTAX_TREE, TEMPLATE_FOLDER } from "./constants";
import {
  createDocumentId,
  createFieldId,
  getTemplateDocumentId,
  SYSTEM_TEMPLATE_OFFSET,
} from "./ids";
import { insertRootInTransforms } from "./transform";
import {
  DBDocument,
  FieldConfig,
  FieldId,
  FieldType,
  RestrictTo,
  SyntaxTree,
  SyntaxTreeRecord,
  Transform,
} from "./types";

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

type DefaultFieldConfig = {
  id: FieldId;
  type?: FieldType;
  label: string;
  restrictTo?: RestrictTo;
  initialValue?: {
    transforms?: Transform[];
    children?: SyntaxTree["children"];
  };
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
    type: "url",
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
    restrictTo: "children",
  },
  layout: {
    id: generateTemplateFieldId(),
    label: "Layout",
    restrictTo: "children",
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

export const generateTemplateFromDefaultFields = (
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

export function getDefaultField(
  id: FieldId
): Omit<FieldConfig, "id"> | undefined {
  return Object.values(DEFAULT_FIELDS).find((value) => {
    return getTemplateDocumentId(value.id) === getTemplateDocumentId(id);
  });
}

export function isDefaultField(
  id: FieldId,
  label: keyof typeof DEFAULT_FIELDS
): boolean {
  return (
    getTemplateDocumentId(DEFAULT_FIELDS[label].id) ===
    getTemplateDocumentId(id)
  );
}
