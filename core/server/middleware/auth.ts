import type { MiddlewareContext } from "@storyflow/rpc-server";
import { error } from "@storyflow/rpc-server/result";
import {
  AuthCookies,
  GLOBAL_SESSION_COOKIE,
  LOCAL_TOKEN,
  parseAuthToken,
} from "../auth";

export const auth =
  (key: string) =>
  async ({ request, client }: MiddlewareContext) => {
    const tokenHeader = request.headers.get("x-storyflow-token");
    /*
    const headers: string[][] = [];
    request.headers.forEach((value, name) => headers.push([name, value]));
    */
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
