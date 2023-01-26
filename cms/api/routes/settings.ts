import { createProcedure, createRoute } from "@sfrpc/server";
import { Settings } from "@storyflow/backend/types";
import { success } from "@storyflow/result";
import { z } from "zod";
import { globals } from "../middleware/globals";
import clientPromise from "../mongo/mongoClient";

export const settings = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { slug }) {
      const client = await clientPromise;

      const org = await client
        .db("cms")
        .collection("organizations")
        .findOne<{ settings?: Settings }>({
          slug,
        });

      return success(org?.settings);
    },
  }),
  set: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        domains: z.array(z.object({ id: z.string(), configUrl: z.string() })),
      });
    },
    async mutation(settings, { slug }) {
      const client = await clientPromise;

      await client.db("cms").collection("organizations").updateOne(
        {
          slug,
        },
        {
          $set: {
            settings,
          },
        }
      );

      return success(true);
    },
  }),
});
