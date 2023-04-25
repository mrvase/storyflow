import { getRawFieldId } from "@storyflow/fields-core/ids";
import { FieldConfig } from "@storyflow/fields-core/types";
import { FieldId } from "@storyflow/shared/types";
import { DocumentConfig, PartialFieldConfig } from "@storyflow/db-core/types";

const compareTemplateFieldId = (id1: FieldId, id2: FieldId) => {
  return getRawFieldId(id1) === getRawFieldId(id2);
};

export const getFieldConfigArray = (template: DocumentConfig) => {
  return template
    .filter((el): el is FieldConfig => Array.isArray(el) || "id" in el)
    .flat(1);
};

export function getFieldConfig(
  template: DocumentConfig,
  id_: FieldId,
  options: { noPartialConfig: true }
): FieldConfig | undefined;
export function getFieldConfig(
  template: DocumentConfig,
  id_: FieldId,
  options?: { noPartialConfig?: boolean }
): FieldConfig | PartialFieldConfig | undefined;
export function getFieldConfig(
  template: DocumentConfig,
  id_: FieldId,
  options: { noPartialConfig?: boolean } = {}
): FieldConfig | PartialFieldConfig | undefined {
  const id = id_;
  let i = 0;
  for (let templateItem of template) {
    if (Array.isArray(templateItem)) {
      const candidate = templateItem.find((el) =>
        compareTemplateFieldId(el.id, id)
      );
      if (candidate) {
        return candidate;
      }
    } else if ("id" in templateItem) {
      if (compareTemplateFieldId(templateItem.id, id)) {
        return templateItem;
      }
    } else if (
      !options.noPartialConfig &&
      "template" in templateItem &&
      templateItem.config
    ) {
      const candidate = templateItem.config.find((el) =>
        compareTemplateFieldId(el.id, id)
      );
      if (candidate) {
        return candidate;
      }
    }
    i++;
  }
}

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
