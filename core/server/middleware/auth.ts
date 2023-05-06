import { MiddlewareContext } from "@sfrpc/server";
import {
  GLOBAL_TOKEN,
  LOCAL_SESSION,
  parseAuthCookie,
  parseAuthToken,
} from "../auth";
import { getHeader } from "../utils";
import { error } from "@storyflow/result";
import { KEY_COOKIE, LOCAL_TOKEN } from "../auth/cookies";

export const servicesAuth = async ({ req, client }: MiddlewareContext) => {
  const cookie = parseAuthCookie(KEY_COOKIE, getHeader(req, "cookie"));

  if (!cookie) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  const tokenHeader = getHeader(req, "X-Storyflow-Token");

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

export const auth = async ({ req, client }: MiddlewareContext) => {
  const session = parseAuthCookie(LOCAL_SESSION, getHeader(req, "cookie"));

  console.log("AUTH SESSION", session);

  if (!session) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  // sikrer gyldighed fra databasen indenfor de sidste 5 minutter
  const tokenHeader = getHeader(req, "X-Storyflow-Token");

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
