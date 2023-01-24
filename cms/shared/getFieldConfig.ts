import { FieldConfig, DocumentConfig } from "@storyflow/core/types";

const getTemplateFieldId = (id: string) => {
  return id.slice(4);
};

const compareTemplateFieldId = (id1: string, id2: string) => {
  return getTemplateFieldId(id1) === getTemplateFieldId(id2);
};

export const getTemplateFields = (template: DocumentConfig) => {
  return template
    .filter((el): el is FieldConfig => Array.isArray(el) || "id" in el)
    .flat(1);
};

export const getFieldConfig = (template: DocumentConfig, id: string) => {
  let topIndex: number | null = null;
  let groupIndex: number | null = null;
  let i = -1;
  for (let templateItem of template) {
    i++;
    if (Array.isArray(templateItem)) {
      let candidate = templateItem.findIndex((el) =>
        compareTemplateFieldId(el.id, id)
      );
      if (candidate >= 0) {
        topIndex = i;
        groupIndex = candidate;
        break;
      }
    }
    if ("id" in templateItem && compareTemplateFieldId(templateItem.id, id)) {
      topIndex = i;
      break;
    }
  }
  if (topIndex !== null) {
    if (groupIndex !== null) {
      return (template[topIndex] as FieldConfig[])[groupIndex];
    } else {
      return template[topIndex] as FieldConfig;
    }
  }
};

export const setFieldConfig = (
  template: DocumentConfig,
  id: string,
  callback: (ps: FieldConfig) => FieldConfig
) => {
  let topIndex: number | null = null;
  let groupIndex: number | null = null;
  let i = -1;
  for (let templateItem of template) {
    i++;
    if (Array.isArray(templateItem)) {
      let candidate = templateItem.findIndex((el) => el.id === id);
      if (candidate >= 0) {
        topIndex = i;
        groupIndex = candidate;
        break;
      }
    }
    if ("id" in templateItem && templateItem.id === id) {
      topIndex = i;
      break;
    }
  }
  if (topIndex !== null) {
    let newTemplate = [...template];
    if (groupIndex !== null) {
      newTemplate[topIndex] = [...(newTemplate[topIndex] as FieldConfig[])];
      (newTemplate[topIndex] as FieldConfig[])[groupIndex] = callback(
        (newTemplate[topIndex] as FieldConfig[])[groupIndex]
      );
    } else {
      newTemplate[topIndex] = callback(newTemplate[topIndex] as FieldConfig);
    }
    return newTemplate;
  }
  return template;
};
