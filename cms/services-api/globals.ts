import { MiddlewareContext } from "@sfrpc/server";

import {
  cors as corsFactory,
  servicesAuth,
} from "@storyflow/server/middleware";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]
);

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors, servicesAuth);
};
