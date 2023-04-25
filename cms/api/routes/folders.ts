import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import type { RawDocumentId } from "@storyflow/shared/types";
import type { DBFolder, DBFolderRaw } from "@storyflow/db-core/types";
import { clientPromise } from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import {
  ZodDocumentOp,
  ZodServerPackage,
  ZodSplice,
  ZodToggle,
} from "../collab-utils/zod";
import {
  client,
  getHistoriesFromIds,
  modifyValues,
  sortHistories,
} from "../collab-utils/redis-client";
import { ServerPackage } from "@storyflow/state";
import { unwrapObjectId } from "@storyflow/db-core/convert";

export const removeObjectId = <T extends { _id: any }>({
  _id,
  ...rest
}: T): Omit<T, "_id"> => rest;

const parseFolder = (raw: DBFolderRaw): DBFolder => {
  const { _id, template, ...rest } = raw;
  return {
    _id: unwrapObjectId(raw._id),
    ...(template && { template: unwrapObjectId(template) }),
    ...rest,
  };
};

export const folders = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const folders = await db
        .collection<DBFolderRaw>("folders")
        .find({})
        .toArray();

      const array: DBFolder[] = folders.map((el) => parseFolder(el));

      const histories = sortHistories(
        (await client.lrange(`${slug}:folders`, 0, -1)) as ServerPackage<any>[]
      );

      return success({ folders: array, histories });
    },
  }),

  sync: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.record(
        z.string(), // document
        z.record(
          z.string(), // key
          ZodServerPackage(
            ZodDocumentOp(
              z.union([
                ZodToggle(z.any()),
                ZodSplice(z.any()),
                z.object({
                  add: z.object({
                    _id: z.string(),
                    type: z.string(),
                    label: z.string(),
                    spaces: z.array(z.any()),
                  }),
                }),
                z.object({ remove: z.string() }),
              ])
            )
          )
        )
      );
    },
    async mutation(input, { slug }) {
      try {
        let pipeline: ReturnType<typeof client.pipeline> | null = null;

        Object.entries(input).map(([key, record]) => {
          let array = Object.values(record);
          if (array.length) {
            if (!pipeline) {
              pipeline = client.pipeline();
            }
            pipeline.rpush(
              `${slug}:${key}`,
              ...array.map((el) => JSON.stringify(el))
            );
          }
        });

        if (pipeline) {
          await (pipeline as any).exec();
        }

        let histories: Awaited<ReturnType<typeof getHistoriesFromIds>> = {};

        let keys = Object.keys(input);

        if (keys.length) {
          histories = await getHistoriesFromIds(
            slug,
            Object.keys(input) as RawDocumentId[]
          );
        }

        const result = modifyValues(histories, (array) => sortHistories(array));

        return success(result);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
});
