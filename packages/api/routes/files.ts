import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import { getClientPromise } from "../mongoClient";
import { globals } from "../globals";
import { StoryflowConfig } from "@storyflow/shared/types";

export const files = (config: StoryflowConfig) => {
  const dbName = config.workspaces[0].db;
  return createRoute({
    getAll: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      async query(_) {
        const db = (await getClientPromise()).db(dbName);

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
};
