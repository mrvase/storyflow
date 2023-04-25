import { functions, Operator, operators } from "@storyflow/shared/types";
import type { FunctionSymbol, OperatorSymbol } from "./types";

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
