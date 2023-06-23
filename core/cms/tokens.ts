import {
  NestedDocument,
  FileToken,
  ColorToken,
  CustomToken,
  NestedElement,
  NestedFolder,
  ContextToken,
  Token,
  StateToken,
  DateToken,
} from "@storyflow/shared/types";
import type { Parameter, NestedField, NestedCreator, LineBreak } from "./types";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

function isNestedField(value: any): value is NestedField {
  return isObject(value) && "field" in value;
}

function isLineBreak(value: any): value is LineBreak {
  return isObject(value) && "n" in value;
}

function isParameter(value: any): value is Parameter {
  return isObject(value) && "x" in value;
}

function isNestedElement(value: any): value is NestedElement {
  return isObject(value) && "id" in value && "element" in value;
}
function isNestedFolder(value: any): value is NestedFolder {
  return isObject(value) && "id" in value && "folder" in value;
}

function isNestedCreator(value: any): value is NestedCreator {
  return isObject(value) && "id" in value && "text" in value;
}

function isNestedDocument(value: any): value is NestedDocument {
  return (
    isObject(value) &&
    "id" in value &&
    !isNestedElement(value) &&
    !isNestedField(value) &&
    !isNestedFolder(value) &&
    !isNestedCreator(value)
  );
}

function isNestedEntity(
  value: any
): value is NestedElement | NestedFolder | NestedDocument | NestedField {
  return isObject(value) && "id" in value;
}

function isFileToken(value: any): value is FileToken {
  return isObject(value) && "src" in value;
}

function isColorToken(value: any): value is ColorToken {
  return isObject(value) && "color" in value;
}

function isCustomToken(value: any): value is CustomToken {
  return isObject(value) && "name" in value;
}

function isContextToken(value: any): value is ContextToken {
  return isObject(value) && "ctx" in value;
}

function isStateToken(value: any): value is StateToken {
  return isObject(value) && "state" in value;
}

function isDateToken(value: any): value is DateToken {
  return isObject(value) && "date" in value;
}

function isToken(value: any): value is Token {
  return (
    isFileToken(value) ||
    isColorToken(value) ||
    isCustomToken(value) ||
    isContextToken(value) ||
    isStateToken(value) ||
    isDateToken(value)
  );
}

function isPrimitiveValue(value: any): value is string | number | boolean {
  return typeof value !== "object" || isToken(value) || isNestedDocument(value);
  // || isNestedFolder(value) || isNestedElement(value) <-- I cannot include these, as they need to be calculated to get their nested references
}

function hasVariableLength(value: any): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

export const tokens = {
  isNestedField,
  isNestedFolder,
  isNestedElement,
  isNestedDocument,
  isNestedCreator,
  isNestedEntity,
  isLineBreak,
  isParameter,
  isPrimitiveValue,
  isFileToken,
  isColorToken,
  isCustomToken,
  isContextToken,
  isStateToken,
  isDateToken,
  isToken,
  hasVariableLength,
};
