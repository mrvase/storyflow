import {
  DBSymbol,
  DBSymbolKey,
  Parameter,
  EditorSymbol,
  FunctionName,
  NestedDocument,
  Operator,
  EditorSymbolKey,
  operators,
  FileToken,
  ColorToken,
  CustomToken,
  RawFieldId,
  NestedField,
  NestedElement,
  NestedFolder,
  ContextToken,
} from "./types";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

function isEditorSymbol<T extends Operator>(
  value: any,
  type: T
): value is { _: T };
function isEditorSymbol<T extends "_">(
  value: any,
  type: T
): value is { _: Operator };
function isEditorSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T
): value is { ")": true | F };
function isEditorSymbol<T extends EditorSymbolKey>(
  value: any,
  type: T
): value is { [key in T]: true };
function isEditorSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T,
  func: F
): value is { ")": F };
function isEditorSymbol<
  T extends Operator | EditorSymbolKey,
  F extends FunctionName
>(value: any, type?: T, func?: F): value is EditorSymbol {
  if (!isObject(value)) {
    return false;
  }
  if (type && operators.some((el) => el === type)) {
    return value._ === type;
  }
  if (type && type in value) {
    return !func || value[type] === func;
  }
  return false;
}

function isDBSymbol<T extends DBSymbolKey>(
  value: any,
  key: "p"
): value is { p: RawFieldId };
function isDBSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  key: T
): value is { ")": true | F };
function isDBSymbol<T extends DBSymbolKey>(
  value: any,
  key: T
): value is { [key in T]: true };
function isDBSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  key: T,
  func: F
): value is { ")": F };
function isDBSymbol<T extends DBSymbolKey, F extends Operator | FunctionName>(
  value: any,
  key: T,
  func?: F
): value is DBSymbol {
  return isObject(value) && key in value && (!func || value[key] === func);
}

function isNestedField(value: any): value is NestedField {
  return isObject(value) && "id" in value && "field" in value;
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

function isNestedDocument(value: any): value is NestedDocument {
  return (
    isObject(value) &&
    "id" in value &&
    !isNestedElement(value) &&
    !isNestedField(value) &&
    !isNestedFolder(value)
  );
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

function isPrimitiveValue(value: any) {
  return typeof value !== "object";
}

export const symb = {
  isEditorSymbol,
  isDBSymbol,
  isNestedField,
  isNestedFolder,
  isLineBreak,
  isParameter,
  isNestedElement,
  isNestedDocument,
  isPrimitiveValue,
  isFileToken,
  isColorToken,
  isCustomToken,
  isContextToken,
};
