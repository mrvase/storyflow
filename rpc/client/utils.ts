import qs from "qs";
import type { SharedOptions } from "./types";

export const queryKey = (route: string, input: any, context?: any) => {
  const query = `?${qs.stringify({
    ...(input && { query: input }),
    ...(context && { context }),
  })}`;
  return `${route}${query}`;
};

export const externalKey = (
  url: { apiUrl: string; route: string; externalProcedure: string },
  input: any,
  context?: any
) => {
  return queryKey(
    url.externalProcedure.indexOf("/") > 0
      ? `${url.apiUrl}/${url.externalProcedure}`
      : `${url.apiUrl}/${url.route}/${url.externalProcedure}`,
    input,
    context
  );
};

export const getContext = (
  opt: SharedOptions["context"],
  ctx: Record<string, any> | undefined
) => {
  return typeof opt === "function" ? opt(ctx ?? {}) : opt ?? ctx ?? {};
};
