import {
  EditorSymbol,
  DocumentImport,
  FieldImport,
  FunctionName,
  LayoutElement,
  NestedDocument,
  Operator,
  Parameter,
  DBSymbol,
  Fetcher,
  Token,
} from "./types";

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

function isDBSymbol(value: any): value is DBSymbol;
function isDBSymbol<T extends DBSymbol[0]>(value: any, type: T): value is [T];
function isDBSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  type: T
): value is [T, F?];
function isDBSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  type: T,
  func: F
): value is [T, F];
function isDBSymbol<T extends DBSymbol[0], F extends Operator | FunctionName>(
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
function isImport(value: any, specify: "field"): value is FieldImport;
function isImport(value: any, specify: "document"): value is DocumentImport;
function isImport(value: any): value is DocumentImport | FieldImport;
function isImport(
  value: any,
  specify?: "field" | "document"
): value is DocumentImport | FieldImport {
  const isObject = value !== null && typeof value === "object";
  const isFieldImport = isObject && "fref" in value;
  const isDocumentImport = isObject && "dref" in value;
  return (
    (specify === "field" && isFieldImport) ||
    (specify === "document" && isDocumentImport) ||
    (!specify && (isFieldImport || isDocumentImport))
  );
}

function isLineBreak(value: any): value is Parameter {
  return Array.isArray(value) && value[0] === "n";
}

function isParameter(value: any): value is Parameter {
  return Array.isArray(value) && typeof value[0] === "number";
}

function isLayoutElement(value: any): value is LayoutElement {
  return value !== null && typeof value === "object" && "type" in value;
}

function isNestedDocument(value: any): value is NestedDocument {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    "values" in value
  );
}

function isToken(value: any): value is Token {
  return (
    Array.isArray(value) && typeof value[0] === "string" && value[0].length > 2
  );
}

function isFetcher(value: any): value is Fetcher {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    "filters" in value
  );
}

function isValue(value: any) {
  return typeof value !== "object";
}

export const symb = {
  isSymbol,
  isDBSymbol,
  isImport,
  isLineBreak,
  isParameter,
  isLayoutElement,
  isNestedDocument,
  isFetcher,
  isValue,
  isToken,
};
