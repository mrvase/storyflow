import { procedure } from "./procedure";

export const cors = (allowedOrigins?: string[] | "allow-all") =>
  procedure.middleware(async (input, ctx, next) => {
    if (!allowedOrigins || !ctx.res || !ctx.req) {
      return next(input, { ...ctx, cors: false });
    }

    const headers = ctx.res.headers;

    const origin = ctx.req.headers.get("origin");
    if (
      origin &&
      (allowedOrigins === "allow-all" || allowedOrigins.includes(origin))
    ) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "origin, x-requested-with, content-type, accept, authorization, content-encoding, x-storyflow-token"
      );
      headers.set("Access-Control-Allow-Credentials", "true");

      return next(input, { ...ctx, cors: true });
    }
    return next(input, { ...ctx, cors: false });
  });
