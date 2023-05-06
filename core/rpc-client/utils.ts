import qs from "qs";
import type { SharedOptions } from "./types";

export const queryKey = (route: string, input: any, ctx?: any) => {
  const query = `?${qs.stringify({
    ...(input && { query: input }),
    ...(ctx && { ctx }),
  })}`;
  return `${route}${query}`;
};

export const mutationKey = (route: string, ctx?: any) => {
  const query = ctx ? `?${qs.stringify({ ctx })}` : "";
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
