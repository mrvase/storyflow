import {
  AuthCookies,
  EMAIL_HTTP_COOKIE,
  LOCAL_TOKEN,
  TOKEN_HTTP_COOKIE,
  parseAuthToken,
} from "../auth";
import { procedure } from "./procedure";
import { RPCError } from "@nanorpc/server";

const UNAUTHORIZED_ERROR = new RPCError({
  status: 401,
  code: "UNAUTHORIZED",
});

export const auth = (keyFromArg?: string) =>
  procedure.middleware(async (input, ctx, next) => {
    if (!ctx.req || ctx.req.method === "OPTIONS") {
      return next(input, { ...ctx, email: "" });
    }
    const key = keyFromArg ?? (ctx as any).key;
    if (!key) {
      return UNAUTHORIZED_ERROR;
    }
    const tokenHeader = ctx.req.headers.get("x-storyflow-token");
    let token = parseAuthToken(LOCAL_TOKEN, tokenHeader, key);
    if (!token) {
      const tokenCookie = ctx.req
        .cookies<AuthCookies>()
        .get(TOKEN_HTTP_COOKIE)?.value;
      token = parseAuthToken(LOCAL_TOKEN, tokenCookie, key);
    }
    if (!token) {
      return UNAUTHORIZED_ERROR;
    }
    return next(input, { ...ctx, email: token.email });
  });

export const emailAuth = procedure.middleware(async (input, ctx, next) => {
  if (!ctx.req || ctx.req.method === "OPTIONS")
    return next(input, { ...ctx, email: "" });
  const user = ctx.req.cookies<AuthCookies>().get(EMAIL_HTTP_COOKIE)?.value;
  if (!user) {
    return UNAUTHORIZED_ERROR;
  }
  return next(input, { ...ctx, email: user.email });
});
