import {
  FunctionName,
  functions,
  FunctionSymbol,
  Operator,
  operators,
  OperatorSymbol,
  TokenStreamSymbol,
} from "./types";

type KeysOfUnion<T> = T extends T ? keyof T : never;
type SymbolKey = KeysOfUnion<TokenStreamSymbol>;

export function isOperator(value: unknown): value is Operator {
  return operators.includes(value as "+");
}

export function isOperatorSymbol(value: unknown): value is OperatorSymbol {
  if (value === null || typeof value !== "object") return false;
  const firstKey = Object.keys(value)[0];
  return operators.includes(firstKey as any);
}

export function isFunctionSymbol(value: unknown): value is FunctionSymbol {
  if (value === null || typeof value !== "object") return false;
  const firstKey = Object.keys(value)[0];
  return functions.includes(firstKey as any);
}

export function isSymbol<T extends "_">(
  value: any,
  type: T
): value is { _: Operator };
export function isSymbol<T extends Operator>(
  value: any,
  type: T
): value is { _: T };
export function isSymbol<T extends ")" | "(" | "[" | "]" | ",">(
  value: any,
  type: T
): value is { [key in T]: true };
export function isSymbol<T extends FunctionName>(
  value: any,
  type: T
): value is Extract<FunctionSymbol, { [key in T]: any }>;
export function isSymbol<
  T extends Operator | SymbolKey,
  F extends FunctionName
>(value: any, type?: T, func?: F): value is TokenStreamSymbol {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (isOperator(type)) {
    return value._ === type;
  }
  if (type && type in value) {
    return !func || value[type] === func;
  }
  return false;
}
