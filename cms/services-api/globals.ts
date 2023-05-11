import { MiddlewareContext } from "@storyflow/rpc-server";
import { error } from "@storyflow/rpc-server/result";
import { AuthCookies, KEY_COOKIE } from "@storyflow/server/auth";

import { cors as corsFactory, auth } from "@storyflow/server/middleware";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? undefined : ["http://localhost:5173"]
);

const injectKeyFromCookie = (middleware: typeof auth) => {
  return (ctx: MiddlewareContext) => {
    const cookie = ctx.request.cookies<AuthCookies>().get(KEY_COOKIE)?.value;
    if (!cookie) {
      throw error({
        message: "Not authorized.",
        status: 401,
      });
    }
    return middleware(cookie.key)(ctx);
  };
};

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors, injectKeyFromCookie(auth));
};
