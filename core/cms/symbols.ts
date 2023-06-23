import { FunctionName, Operator, operators } from "@storyflow/shared/types";
import type { FunctionSymbol, OperatorSymbol } from "./types";
import { FUNCTIONS } from "./constants";

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
  return FUNCTIONS.includes(firstKey as any);
}

export function getFunctionName(value: FunctionSymbol): FunctionName {
  return Object.keys(value)[0] as FunctionName;
}
