import {
  createDocumentId,
  createFieldId,
  createTemplateFieldId,
  getRawFieldId,
  SYSTEM_TEMPLATE_OFFSET,
} from "./ids";
import { FieldId, RawFieldId } from "./types";

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

export const FIELDS = assignIds({
  creation_date: {
    type: "default",
    label: "Oprettelsesdato",
  },
  label: {
    type: "default",
    label: "Label",
  },
  url: {
    type: "url",
    label: "URL",
  },
  slug: {
    type: "slug",
    label: "Slug",
  },
  page: {
    type: "default",
    label: "Side",
  },
  layout: {
    type: "default",
    label: "Layout",
  },
  redirect: {
    type: "url",
    label: "Omdiriger",
  },
  published: {
    type: "default",
    label: "Offentlig",
  },
  released: {
    type: "default",
    label: "Udgivelsesdato",
  },
  user: {
    type: "default",
    label: "Brugeremail",
  },
} as const);

export function getDefaultField(id: FieldId) {
  return (
    Object.entries(FIELDS).find(([, value]) => {
      return value.id === getRawFieldId(id);
    }) ?? [undefined, undefined]
  );
}
