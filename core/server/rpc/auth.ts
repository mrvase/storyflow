import {
  AuthCookies,
  GLOBAL_SESSION_COOKIE,
  LOCAL_TOKEN,
  parseAuthToken,
} from "../auth";
import { baseProcedure } from "./procedure";
import { RPCError } from "@nanorpc/server";

const UNAUTHORIZED_ERROR = new RPCError({
  status: 401,
  code: "UNAUTHORIZED",
});

export const auth = (keyFromArg?: string) =>
  baseProcedure.middleware(async (input, ctx, next) => {
    if (!ctx.req || ctx.req.method === "OPTIONS") {
      return next(input, { ...ctx, email: "" });
    }
    const tokenHeader = ctx.req.headers.get("x-storyflow-token");
    const key = keyFromArg ?? (ctx as any).key;
    if (!key) {
      return UNAUTHORIZED_ERROR;
    }
    const token = parseAuthToken(LOCAL_TOKEN, tokenHeader, key);
    if (!token) {
      return UNAUTHORIZED_ERROR;
    }
    return next(input, { ...ctx, email: token.email });
  });

export const emailAuth = baseProcedure.middleware(async (input, ctx, next) => {
  if (!ctx.req || ctx.req.method === "OPTIONS")
    return next(input, { ...ctx, email: "" });
  const user = ctx.req.cookies<AuthCookies>().get(GLOBAL_SESSION_COOKIE)?.value;
  if (!user) {
    return UNAUTHORIZED_ERROR;
  }
  return next(input, { ...ctx, email: user.email });
});

/*
export const auth =
  (key: string) =>
  async ({ request, client }: MiddlewareContext) => {
    const tokenHeader = request.headers.get("x-storyflow-token");
    const token = parseAuthToken(LOCAL_TOKEN, tokenHeader, key);

    if (!token) {
      throw error({
        message: tokenHeader ? "Token not valid" : "Not authorized",
        status: 401,
      });
    }

    return {
      email: token.email,
      slug: client.slug as string,
    };
  };

export const emailAuth = async ({ request }: MiddlewareContext) => {
  const user = request.cookies<AuthCookies>().get(GLOBAL_SESSION_COOKIE)?.value;

  if (!user) {
    throw error({ message: "Not authenticated", status: 401 });
  }

  return {
    email: user.email,
  };
};
*/
