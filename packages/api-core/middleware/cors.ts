import type { MiddlewareContext } from "@sfrpc/server";

export function cors(allowedOrigins: string[] | "allow-all") {
  return async ({ req, res }: MiddlewareContext) => {
    if (
      req.headers.origin &&
      (allowedOrigins === "allow-all" ||
        allowedOrigins.includes(req.headers.origin))
    ) {
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, X-Storyflow-Token"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      return {
        cors: true,
      };
    }

    return {
      cors: false,
    };
  };
}
