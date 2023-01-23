import qs from "qs";
import type { SharedOptions } from "./types";

export const queryKey = (route: string, input: any, context?: any) => {
  const query = `?${qs.stringify({
    ...(input && { query: input }),
    ...(context && { context }),
  })}`;
  return `${route}${query}`;
};

export const getContext = (
  opt: SharedOptions["context"],
  ctx: Record<string, any> | undefined
) => {
  return typeof opt === "function" ? opt(ctx ?? {}) : opt ?? ctx ?? {};
};
