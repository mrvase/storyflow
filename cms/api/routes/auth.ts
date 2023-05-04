import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { cors as corsFactory } from "@storyflow/api-core/middleware";
import { getHeader } from "@storyflow/api-core/utils";
import { z } from "zod";
import {
  GLOBAL_TOKEN,
  LINK_COOKIE,
  LOCAL_SESSION,
  parseAuthCookie,
  parseAuthToken,
  serializeAuthCookie,
} from "@storyflow/api-core/auth";

export const auth = createRoute({
  update: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory(["http://localhost:5173"]));
    },
    async mutation(_, { res, req }) {
      try {
        const cookie = parseAuthCookie(
          LOCAL_SESSION,
          getHeader(req as any, "cookie")
        );

        if (cookie) {
          return success({ email: cookie.email });
        }

        const token = parseAuthToken(
          GLOBAL_TOKEN,
          getHeader(req as any, "X-Storyflow-Token")
        );

        if (!user) {
          return error({ message: "Not authenticated" });
        }

        res.setHeader("Set-Cookie", serializeAuthCookie(GLOBAL_TOKEN, user));

        return success({ email: user.email });
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
});
