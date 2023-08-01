import { RPCError } from "@nanorpc/server";
import { procedure, auth, cors } from "@storyflow/server/rpc";

import { ApiConfig } from "@storyflow/shared/types";

export const globals = (config: ApiConfig) =>
  procedure.use(cors(config.cors ?? [])).use(auth(config.publicKey));

export const httpOnly = procedure.middleware(async (input, ctx, next) => {
  const req = ctx.req;
  const res = ctx.res;
  if (!req || !res) {
    return new RPCError({
      code: "SERVER_ERROR",
      message: "This endpoint should only be used with an API request",
    });
  }
  return await next(input, { ...ctx, req, res });
});
