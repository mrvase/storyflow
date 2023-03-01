import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { createIdFromNumber } from "@storyflow/backend/ids";
import { Db } from "mongodb";

export const COUNTER_OFFSET = 100;

export const getShortIds = async (name: string, size: number, db: Db) => {
  const counter = await db
    .collection("counters")
    .findOneAndUpdate({ name }, { $inc: { counter: size } });

  if (!counter.ok) {
    console.log("failed");
    throw new Error("Failed creating folder");
  }

  // to make sure that "super templates" can have ids

  const result = (counter.value ?? { counter: 0 }).counter;

  return Array.from({ length: size }, (_, i) =>
    createIdFromNumber(COUNTER_OFFSET + result + 1 + i)
  );
};

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
  getIds: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        name: z.union([z.literal("documents"), z.literal("folders")]),
        size: z.number(),
      });
    },
    async query({ name, size }, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const array = await getShortIds(name, size, db);

      return success(array);
    },
  }),
});
