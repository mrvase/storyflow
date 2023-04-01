import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";

export const files = createRoute({
  getAll: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const files = await db
        .collection("files")
        .find()
        .sort({ _id: -1 })
        .toArray();

      return success(
        files.map(({ _id, ...rest }) => rest) as {
          name: string;
          label: string;
        }[]
      );
    },
  }),
});
