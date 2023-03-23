import { getRawFieldId, revertTemplateFieldId } from "@storyflow/backend/ids";
import { FieldConfig, DocumentConfig, FieldId } from "@storyflow/backend/types";

const compareTemplateFieldId = (id1: FieldId, id2: FieldId) => {
  return getRawFieldId(id1) === getRawFieldId(id2);
};

export const getFieldConfigArray = (template: DocumentConfig) => {
  return template
    .filter((el): el is FieldConfig => Array.isArray(el) || "id" in el)
    .flat(1);
};

export const getFieldConfig = (template: DocumentConfig, id_: FieldId) => {
  const id = id_;
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
  id: FieldId,
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
