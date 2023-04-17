import {
  Parameter,
  NestedDocument,
  FileToken,
  ColorToken,
  CustomToken,
  NestedField,
  NestedElement,
  NestedFolder,
  ContextToken,
  Token,
  NestedCreator,
  LoopToken,
  StateToken,
} from "./types";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

function isNestedField(value: any): value is NestedField {
  return isObject(value) && "field" in value;
}

function isLineBreak(value: any): value is Parameter {
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

function isLoopToken(value: any): value is LoopToken {
  return isObject(value) && "loop" in value;
}

function isToken(value: any): value is Token {
  return (
    isFileToken(value) ||
    isColorToken(value) ||
    isCustomToken(value) ||
    isContextToken(value) ||
    isStateToken(value) ||
    isLoopToken(value)
  );
}

function isPrimitiveValue(
  value: any
): value is string | number | boolean | Date {
  return typeof value !== "object" || value instanceof Date;
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
  isLoopToken,
  isToken,
};
