import { client } from "../mongo";
import { globals } from "../globals";
import { StoryflowConfig } from "@storyflow/shared/types";
import { procedure } from "@storyflow/server/rpc";
import { z } from "zod";
import { RPCError } from "@nanorpc/server";

export const files = (config: StoryflowConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return {
    getAll: procedure.use(globals(config.api)).query(async (_) => {
      const db = await client.get(dbName);

      const files = await db
        .collection("files")
        .find()
        .sort({ _id: -1 })
        .toArray();

      return files.map(({ _id, ...rest }) => rest) as {
        name: string;
        label: string;
      }[];
    }),

    saveFile: procedure
      .use(globals(config.api))
      .schema(z.object({ name: z.string(), label: z.string() }))
      .mutate(async (file) => {
        const db = await client.get(dbName);
        const result = await db.collection("files").insertOne(file);
        if (!result.acknowledged) {
          return new RPCError({ code: "FAILED" });
        } else {
          return null;
        }
      }),

    renameFile: procedure
      .use(globals(config.api))
      .schema(z.object({ name: z.string(), label: z.string() }))
      .mutate(async (file) => {
        const db = await client.get(dbName);
        const result = await db
          .collection("files")
          .updateOne({ name: file.name }, { $set: { label: file.label } });
        if (!result.acknowledged) {
          return new RPCError({ code: "FAILED" });
        } else {
          return null;
        }
      }),
  };
};
