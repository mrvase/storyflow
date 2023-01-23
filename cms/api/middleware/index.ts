import { MiddlewareContext } from "@sfrpc/server";

import { cors as corsFactory } from "./cors";

export const cors = corsFactory(["http://localhost:5173"]);

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors);
};
