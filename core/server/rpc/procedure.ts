import { createProcedure } from "@nanorpc/server";
import { Context } from "../next";
import type {} from "zod";

export const baseProcedure = createProcedure<Context>();

const commitHeaders = baseProcedure.middleware(async (input, ctx, next) => {
  const result = await next(input, ctx);
  ctx.res?.commit();
  return result;
});

export const procedure = baseProcedure.use(commitHeaders);
