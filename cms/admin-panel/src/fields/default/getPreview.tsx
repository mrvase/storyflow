import { Value } from "@storyflow/backend/types";

export const getPreview = (output: Value[]) => {
  const valueAsString = (value: any) => {
    if (typeof value === "boolean") {
      return value ? "SAND" : "FALSK";
    }
    if (typeof value === "number") {
      return value.toFixed(2).replace(".", ",").replace(",00", "");
    }
    if (Array.isArray(value)) {
      return "type" in value ? `{ ${value.type} }` : "[Liste]";
    }
    if (value === null) {
      return "";
    }
    if (typeof value === "object") {
      return "type" in value ? `{ ${value.type} }` : "{Dokument}";
    }
    return `${value}`;
  };
  if (output.length === 0) {
    return "";
  }
  if (output.length === 1) {
    return valueAsString(output[0]);
  }

  // return `[${output.length} elementer]`;
  return `[${output.map((el) => valueAsString(el)).join(", ")}]`;
};
