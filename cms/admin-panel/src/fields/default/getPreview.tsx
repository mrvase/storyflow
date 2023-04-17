import { ClientSyntaxTree, ValueArray } from "@storyflow/backend/types";

const valueAsString = (value: any, placeholders: boolean) => {
  if (typeof value === "boolean") {
    return value ? "SAND" : "FALSK";
  }
  if (typeof value === "number") {
    return value.toFixed(2).replace(".", ",").replace(",00", "");
  }
  if (Array.isArray(value)) {
    if (!placeholders) return "";
    return "type" in value ? `{ ${value.type} }` : "[Liste]";
  }
  if (value === null) {
    return "";
  }
  if (typeof value === "object") {
    if (!placeholders) return "";
    return "type" in value ? `{ ${value.type} }` : "{Dokument}";
  }
  return `${value}`;
};

export const getPreview = (value: ValueArray | ClientSyntaxTree) => {
  if (!Array.isArray(value)) {
    return "";
  }

  if (value.length === 0) {
    return "";
  }
  if (value.length === 1) {
    return valueAsString(value[0], false);
  }

  // return `[${output.length} elementer]`;
  return `[${value.map((el) => valueAsString(el, true)).join(", ")}]`;
};
