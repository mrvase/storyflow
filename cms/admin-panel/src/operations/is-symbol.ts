import type { FunctionName, Operator } from "@storyflow/shared/types";
import type { TokenStreamSymbol } from "./types";
import type { FunctionSymbol } from "@storyflow/cms/types";
import { isOperator } from "@storyflow/cms/symbols";

type KeysOfUnion<T> = T extends T ? keyof T : never;
type SymbolKey = KeysOfUnion<TokenStreamSymbol>;

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
