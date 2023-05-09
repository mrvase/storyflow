import type { MiddlewareContext } from "@storyflow/rpc-server";

import { auth, cors } from "@storyflow/server/middleware";
import { ApiConfig } from "@storyflow/shared/types";

export const globals = (config: ApiConfig) => (ctx: MiddlewareContext) => {
  return ctx.use(cors(config.cors), auth);
};
