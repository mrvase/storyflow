import { FunctionName, Operator, operators, TokenStreamSymbol } from "./types2";

type KeysOfUnion<T> = T extends T ? keyof T : never;
type SymbolKey = KeysOfUnion<TokenStreamSymbol>;

export function isSymbol<T extends Operator>(
  value: any,
  type: T
): value is { _: T };
export function isSymbol<T extends "_">(
  value: any,
  type: T
): value is { _: Operator };
export function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T
): value is { ")": true | F };
export function isSymbol<T extends SymbolKey>(
  value: any,
  type: T
): value is { [key in T]: true };
export function isSymbol<T extends ")", F extends FunctionName>(
  value: any,
  type: T,
  func: F
): value is { ")": F };
export function isSymbol<
  T extends Operator | SymbolKey,
  F extends FunctionName
>(value: any, type?: T, func?: F): value is TokenStreamSymbol {
  if (value === null || typeof value !== "object") {
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
