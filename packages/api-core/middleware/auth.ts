import { MiddlewareContext } from "@sfrpc/server";
import { GLOBAL_TOKEN, parseAuthToken } from "../auth";
import { getHeader } from "../utils";
import { error } from "@storyflow/result";

export const auth = async ({ req, client }: MiddlewareContext) => {
  const cookie = parseAuthToken(
    GLOBAL_TOKEN,
    getHeader(req, "X-Storyflow-Token")
  );

  if (!cookie) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  return {
    user: cookie.email,
    slug: client.slug as string,
    dbName: `${client.slug}`,
  };
};
