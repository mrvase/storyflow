import { MiddlewareContext } from "@sfrpc/server";

import { auth, cors as corsFactory } from "@storyflow/api-core/middleware";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]
);

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors, auth);
};
