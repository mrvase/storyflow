import { ValueArray } from "@storyflow/backend/types";

export const getPreview = (output: ValueArray) => {
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
  if (output.length === 0) {
    return "";
  }
  if (output.length === 1) {
    return valueAsString(output[0], false);
  }

  // return `[${output.length} elementer]`;
  return `[${output.map((el) => valueAsString(el, true)).join(", ")}]`;
};
