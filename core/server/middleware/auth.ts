import { MiddlewareContext } from "@sfrpc/server";
import { GLOBAL_TOKEN, parseAuthCookie, parseAuthToken } from "../auth";
import { getHeader } from "../utils";
import { error } from "@storyflow/result";
import { KEY_COOKIE } from "../auth/cookies";

export const auth = async ({ req, client }: MiddlewareContext) => {
  const cookie = parseAuthCookie(KEY_COOKIE, getHeader(req, "cookie"));

  if (!cookie) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  const token = parseAuthToken(
    GLOBAL_TOKEN,
    getHeader(req, "X-Storyflow-Token"),
    cookie.key
  );

  if (!token) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  return {
    user: token.email,
    slug: client.slug as string,
  };
};
