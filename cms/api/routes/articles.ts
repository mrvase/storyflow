import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import { globals } from "../middleware";

export const articles = createRoute({
  getArticle: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    query(string) {
      return success(`user is: ${string}`);
    },
  }),
});
