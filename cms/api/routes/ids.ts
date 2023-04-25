import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import { clientPromise } from "../mongo/mongoClient";
import { globals } from "../middleware/globals";

export const ids = createRoute({
  getWorkspaceId: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName }) {
      const id = dbName?.split("-")[1];
      if (!id) {
        return error({ message: "No workspace id" });
      }
      return success(id);
    },
  }),
  getOffset: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        name: z.union([
          z.literal("id"),
          z.literal("template"),
          z.literal("field"),
        ]),
        size: z.number(),
      });
    },
    async query({ name, size }, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const counter = await db
        .collection<{ name: string; counter: number }>("counters")
        .findOneAndUpdate({ name }, { $inc: { counter: size } });

      if (!counter.ok) {
        console.log("failed");
        throw new Error("Failed creating folder");
      }

      const result = (counter.value ?? { counter: 0 }).counter;

      return success(result);
    },
  }),
});
