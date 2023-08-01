import { AuthCookies, KEY_COOKIE } from "@storyflow/server/auth";
import { RPCError } from "@nanorpc/server";

import { cors as corsFactory, auth, procedure } from "@storyflow/server/rpc";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? undefined : ["http://localhost:3000"]
);

const getDataFromKeyCookie = procedure.middleware(async (input, ctx, next) => {
  const cookie = ctx.req?.cookies<AuthCookies>().get(KEY_COOKIE)?.value;
  if (!cookie) {
    return new RPCError({ code: "UNAUTHORIZED", status: 401 });
  }
  return await next(input, { ...ctx, key: cookie.key, slug: cookie.slug });
});

export const globals = procedure
  .use(cors)
  .use(getDataFromKeyCookie)
  .use(auth());

export const httpOnly = procedure.middleware(async (input, ctx, next) => {
  const req = ctx.req;
  const res = ctx.res;
  if (!req || !res) {
    return new RPCError({
      code: "SERVER_ERROR",
      message: "This endpoint should only be used with an API request",
    });
  }
  return await next(input, { ...ctx, req, res });
});
