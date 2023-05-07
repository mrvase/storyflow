import type { MiddlewareContext } from "@storyflow/rpc-server";
import { error } from "@storyflow/rpc-server/result";
import { LOCAL_SESSION, parseAuthToken } from "../auth";
import { getHeader } from "../utils";
import { KEY_COOKIE, LOCAL_TOKEN, AuthCookies } from "../auth/cookies";

export const servicesAuth = async ({ request, client }: MiddlewareContext) => {
  const cookie = request.cookies<AuthCookies>().get(KEY_COOKIE)?.value;

  if (!cookie) {
    throw error({
      message: "Not authorized.",
      status: 401,
    });
  }

  const tokenHeader = request.headers.get("X-Storyflow-Token");

  const token = parseAuthToken(LOCAL_TOKEN, tokenHeader, cookie.key);

  console.log("AUTH TOKEN - services", token);

  if (!token) {
    throw error({
      message: tokenHeader ? "Token not valid" : "Not authorized.",
      status: 401,
    });
  }

  return {
    user: token.email,
    slug: client.slug as string,
  };
};

export const auth = async ({ request, client }: MiddlewareContext) => {
  const session = request.cookies<AuthCookies>().get(LOCAL_SESSION)?.value;

  console.log("AUTH SESSION", session);

  if (!session) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  // sikrer gyldighed fra databasen indenfor de sidste 5 minutter
  const tokenHeader = request.headers.get("X-Storyflow-Token");

  const token = parseAuthToken(
    LOCAL_TOKEN,
    tokenHeader,
    process.env.PUBLIC_KEY as string
  );

  console.log("AUTH TOKEN", token);

  if (!token) {
    throw error({
      message: tokenHeader ? "Token not valid" : "Not authorized",
      status: 401,
    });
  }

  return {
    user: session.email,
    slug: client.slug as string,
  };
};
