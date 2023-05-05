import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import type { DBDocumentRaw } from "../types";
import type { DBDocument } from "@storyflow/cms/types";
import type {
  DocumentId,
  FieldId,
  FolderId,
  RawFieldId,
  StoryflowConfig,
  ValueArray,
} from "@storyflow/shared/types";
import { getClientPromise } from "../mongoClient";
import { globals } from "../globals";
import { createRawTemplateFieldId } from "@storyflow/cms/ids";
import { parseDocument } from "../convert";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { getPaths } from "../paths";
import { createObjectId } from "../mongo";
import { save } from "../fields/save";
import { createFetcher } from "../create-fetcher";

export const documents = (config: StoryflowConfig) => {
  const dbName = config.workspaces[0].db;
  return createRoute({
    find: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.object({
          folder: z.string(),
          sort: z.array(z.string()).optional(),
          limit: z.number(),
          filters: z.record(z.string(), z.array(z.any())).optional(),
        });
      },
      async query({ folder, filters, limit, sort }) {
        const documents = await createFetcher(dbName!)({
          folder: folder as FolderId,
          filters: filters as Record<FieldId, ValueArray>,
          limit,
          sort,
        });

        return success(documents);
      },
    }),

    findByLabel: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.string();
      },
      async query(string) {
        const db = (await getClientPromise()).db(dbName);

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

        return success(articles);
      },
    }),

    findById: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.string();
      },
      async query(id) {
        const db = (await getClientPromise()).db(dbName);

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
          return success(initialDoc);
          // return error({ message: "No article found" });
        }

        const doc = parseDocument(documentRaw);

        return success(doc);
      },
    }),

    update: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.object({
          id: z.string(),
          folder: z.string(),
          config: z.array(z.any()),
          record: z.record(z.string(), z.any()),
          versions: z.record(z.string(), z.any()),
        });
      },
      async mutation(input) {
        return await save(input, dbName);
      },
    }),

    deleteMany: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.array(z.string());
      },
      async mutation(ids) {
        const db = (await getClientPromise()).db(dbName);

        const removes = ids.map((el) => createObjectId(el));

        const result = await db
          .collection<DBDocumentRaw>("documents")
          .deleteMany({ _id: { $in: removes } });

        if (!result.acknowledged) {
          return error({ message: "Failed to delete" });
        }

        return success(result.acknowledged);
      },
    }),

    getUpdatedUrls: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      schema() {
        return z.object({
          namespace: z.string(),
        });
      },
      async query({ namespace }) {
        const db = (await getClientPromise()).db(dbName);

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

        return success(paths);

        // check update timestamp
      },
    }),

    registerRevalidation: createProcedure({
      middleware(ctx) {
        return ctx.use(globals);
      },
      async mutation(_) {
        const db = (await getClientPromise()).db(dbName);

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

        return success(null);
      },
    }),
  });
};
