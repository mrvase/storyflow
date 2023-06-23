import { tokens } from "@storyflow/cms/tokens";
import type { ClientSyntaxTree, ValueArray } from "@storyflow/shared/types";
import { serializeDate } from "../../data/dates";

const valueAsString = (value: any, placeholders: boolean) => {
  if (typeof value === "boolean") {
    return value ? "SAND" : "FALSK";
  }
  if (typeof value === "number") {
    return value.toFixed(2).replace(".", ",").replace(",00", "");
  }
  if (Array.isArray(value)) {
    if (!placeholders) return "";
    return "[Liste]";
  }
  if (value === null) {
    return "";
  }
  if (typeof value === "object") {
    if (!placeholders) return "";
    if (tokens.isFileToken(value)) {
      return `[Fil]`;
    }
    if (tokens.isNestedElement(value)) {
      return `${value.element.split(":").slice(-1)[0]}`;
    }
    if (tokens.isDateToken(value)) {
      return serializeDate(new Date(value.date));
    }
    if (tokens.isNestedDocument(value)) return "[Dokument]";
    return "[Objekt]";
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
    return valueAsString(value[0], true);
  }

  // return `[${output.length} elementer]`;
  return `${value.map((el) => valueAsString(el, true)).join(", ")}`.trim();
};
