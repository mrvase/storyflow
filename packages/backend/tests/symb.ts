import { DBSymbol, DBSymbolKey, Parameter } from "./calculate";
import {
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
} from "../types";

function isSymbol(value: any): value is EditorSymbol;
function isSymbol<T extends EditorSymbol[0]>(value: any, type: T): value is [T];
function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T
): value is [T, F?];
function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T,
  func: F
): value is [T, F];
function isSymbol<T extends EditorSymbol[0], F extends FunctionName>(
  value: any,
  type?: T,
  func?: F
): value is EditorSymbol {
  return (
    Array.isArray(value) &&
    (!type || value[0] === type) &&
    (!func || value[1] === func)
  );
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
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

function isToken(value: any): value is Token {
  return isObject(value) && ("src" in value || "color" in value);
}

function isFetcher(value: any): value is Fetcher {
  return isObject(value) && "id" in value && "filters" in value;
}

function isValue(value: any) {
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
  isValue,
  isToken,
};
