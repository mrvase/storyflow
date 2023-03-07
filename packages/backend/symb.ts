import {
  DBSymbol,
  DBSymbolKey,
  Parameter,
  EditorSymbol,
  DocumentImport,
  FieldImport,
  FunctionName,
  LayoutElement,
  NestedDocument,
  Operator,
  Fetcher,
  Token,
  TemplateFieldId,
  EditorSymbolKey,
  operators,
  FileToken,
  ColorToken,
  CustomToken,
  ContextImport,
} from "./types";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

function isSymbol<T extends Operator>(value: any, type: T): value is { _: T };
function isSymbol<T extends "_">(value: any, type: T): value is { _: Operator };
function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T
): value is { ")": true | F };
function isSymbol<T extends EditorSymbolKey>(
  value: any,
  type: T
): value is { [key in T]: true };
function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T,
  func: F
): value is { ")": F };
function isSymbol<T extends Operator | EditorSymbolKey, F extends FunctionName>(
  value: any,
  type?: T,
  func?: F
): value is EditorSymbol {
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
): value is { p: TemplateFieldId };
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

function isFieldImport(value: any): value is FieldImport {
  return isObject(value) && "fref" in value;
}

function isDocumentImport(value: any): value is DocumentImport {
  return isObject(value) && "dref" in value;
}

function isLineBreak(value: any): value is Parameter {
  return isObject(value) && "n" in value;
}

function isParameter(value: any): value is Parameter {
  return isObject(value) && "x" in value;
}

function isLayoutElement(value: any): value is LayoutElement {
  return isObject(value) && "type" in value;
}

function isNestedDocument(value: any): value is NestedDocument {
  return isObject(value) && "id" in value && "values" in value;
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

function isFetcher(value: any): value is Fetcher {
  return isObject(value) && "id" in value && "filters" in value;
}

function isContextImport(value: any): value is ContextImport {
  return isObject(value) && "ctx" in value;
}

function isPrimitiveValue(value: any) {
  return typeof value !== "object";
}

export const symb = {
  isSymbol,
  isDBSymbol,
  isFieldImport,
  isDocumentImport,
  isLineBreak,
  isParameter,
  isLayoutElement,
  isNestedDocument,
  isFetcher,
  isPrimitiveValue,
  isFileToken,
  isColorToken,
  isCustomToken,
  isContextImport,
};
