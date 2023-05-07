import type { MiddlewareContext } from "@storyflow/rpc-server";

export function cors(allowedOrigins: string[] | "allow-all") {
  return async ({ request, response }: MiddlewareContext) => {
    const origin = request.headers.get("origin");
    if (
      origin &&
      (allowedOrigins === "allow-all" || allowedOrigins.includes(origin))
    ) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "origin, x-requested-with, content-type, accept, authorization, content-encoding, x-storyflow-token"
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");

      return {
        cors: true,
      };
    }

    return {
      cors: false,
    };
  };
}
