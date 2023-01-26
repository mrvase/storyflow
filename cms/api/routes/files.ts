import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { removeObjectId } from "./articles";

export const ids = createRoute({
  getAll: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const files = await db.collection("files").find().toArray();

      return success(
        files.map(removeObjectId) as { name: string; label: string }[]
      );
    },
  }),
});
