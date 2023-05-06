import type { MiddlewareContext } from "@storyflow/rpc-server";

import { auth, cors as corsFactory } from "@storyflow/server/middleware";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]
);

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors, auth);
};
