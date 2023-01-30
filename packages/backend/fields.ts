import { createIdFromNumber, getTemplateFieldId } from "./ids";
import { FieldId, TemplateFieldId } from "./types";

const assignIds = <T extends Record<string, any>>(
  fields: T
): { [Key in keyof T]: T[Key] & { id: TemplateFieldId } } => {
  let index = 0;
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      {
        ...value,
        id: `${createIdFromNumber(index++)}--------` as TemplateFieldId,
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

export const getDefaultField = (id: FieldId) => {
  return (
    Object.entries(FIELDS).find(
      ([, value]) => value.id === getTemplateFieldId(id)
    ) ?? [undefined, undefined]
  );
};
