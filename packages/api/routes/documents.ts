import { RPCError } from "@nanorpc/server";
import { z } from "zod";
import type { DBDocumentRaw } from "../types";
import type { DBDocument } from "@storyflow/cms/types";
import type {
  DocumentId,
  FieldId,
  FolderId,
  StoryflowConfig,
  ValueArray,
} from "@storyflow/shared/types";
import { client } from "../mongo";
import { globals } from "../globals";
import { createRawTemplateFieldId } from "@storyflow/cms/ids";
import { parseDocument } from "../convert";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { getPaths } from "../paths";
import { createObjectId } from "../mongo";
import { save } from "../fields/save";
import { createFetcher } from "../create-fetcher";
import { procedure } from "@storyflow/server/rpc";

export const documents = (config: StoryflowConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return {
    find: procedure
      .use(globals(config.api))
      .schema((input) => {
        try {
          return z
            .object({
              folder: z.string(),
              limit: z.number(),
              sort: z.array(z.string()).optional(),
              filters: z.record(z.string(), z.array(z.any())).optional(),
            })
            .parse(input);
        } catch (e) {
          console.log("HERE IS THE ERROR:", input, e);
          return new RPCError({ code: "SERVER_ERROR" });
        }
      })
      .query(async ({ folder, filters, limit, sort }) => {
        const documents = await createFetcher(dbName!)({
          folder: folder as FolderId,
          filters: filters as Record<FieldId, ValueArray>,
          limit,
          sort,
        });

        return documents;
      }),

    findByLabel: procedure
      .use(globals(config.api))
      .schema(z.string())
      .query(async (string) => {
        const db = await client.get(dbName);

        const articles = (
          (await db
            .collection<DBDocumentRaw>("documents")
            .find({
              [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.label.id)}`]: {
                $regex: string,
                $options: "i",
              },
            })
            .toArray()) ?? []
        ).map((el) => parseDocument(el));

        return articles;
      }),

    findById: procedure
      .use(globals(config.api))
      .schema(z.string())
      .query(async (id) => {
        const db = await client.get(dbName);

        const documentRaw = await db
          .collection<DBDocumentRaw>("documents")
          .findOne({ _id: createObjectId(id) });

        if (!documentRaw) {
          const initialDoc: DBDocument = {
            _id: id as DocumentId,
            // folder: "" as FolderId,
            versions: { config: [0] },
            config: [],
            record: {},
          };
          return initialDoc;
          // return error({ message: "No article found" });
        }

        const doc = parseDocument(documentRaw);

        return doc;
      }),

    update: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          id: z.string(),
          folder: z.string(),
          config: z.array(z.any()),
          record: z.record(z.string(), z.any()),
          versions: z.record(z.string(), z.any()),
        })
      )
      .mutate(async (input) => {
        return await save(input, dbName);
      }),

    deleteMany: procedure
      .use(globals(config.api))
      .schema(z.array(z.string()))
      .mutate(async (ids) => {
        const db = await client.get(dbName);

        const removes = ids.map((el) => createObjectId(el));

        const result = await db
          .collection<DBDocumentRaw>("documents")
          .deleteMany({ _id: { $in: removes } });

        if (!result.acknowledged) {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Failed to delete",
          });
        }

        return result.acknowledged;
      }),

    getUpdatedUrls: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          namespace: z.string(),
        })
      )
      .query(async ({ namespace }) => {
        const db = await client.get(dbName);

        const lastBuildCounter =
          (
            await db
              .collection<{ name: string; counter: number }>("counters")
              .findOne({
                name: "build",
              })
          )?.counter ?? 0;

        const docs = await db
          .collection<DBDocumentRaw>("documents")
          .find({
            ...(namespace
              ? { folder: createObjectId(namespace) }
              : {
                  [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]:
                    {
                      $exists: true,
                    },
                }),
          })
          .toArray();

        const fields = [
          DEFAULT_FIELDS.layout.id,
          DEFAULT_FIELDS.url.id,
          DEFAULT_FIELDS.page.id,
          DEFAULT_FIELDS.label.id,
        ].map((el) => createRawTemplateFieldId(el));

        const layoutUpdates = docs
          .filter((el) => el.updated[fields[0]] > lastBuildCounter)
          .map((el) => el.values[fields[1]][0] as string);

        const docsFiltered = docs.reduce((acc: DBDocumentRaw[], el) => {
          const url = el.values[fields[1]]?.[0] as string | undefined;
          if (!url) return acc;
          const shouldUpdate =
            fields.some((field) => el.updated[field] > lastBuildCounter) ||
            layoutUpdates.some((el) => url.startsWith(el));
          if (shouldUpdate) {
            acc.push(el);
          }
          return acc;
        }, []);

        const paths = await getPaths(docsFiltered, createFetcher(dbName!));

        console.log("REVALIDATE", paths);

        // const paths = urls.map((el) => `/${el.replace("://", "").split("/")[1]}`);

        /*
      const result = await fetch(revalidateUrl, {
        body: JSON.stringify(urls),
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      */

        return paths;

        // check update timestamp
      }),

    registerRevalidation: procedure
      .use(globals(config.api))
      .mutate(async () => {
        const db = await client.get(dbName);

        await db
          .collection<{ name: string; counter: number }>("counters")
          .updateOne(
            {
              name: "build",
            },
            {
              $set: {
                counter: Date.now(),
              },
            },
            {
              upsert: true,
            }
          );

        return null;
      }),
  };
};
