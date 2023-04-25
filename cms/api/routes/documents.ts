import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import type { DBDocument, DBDocumentRaw } from "@storyflow/db-core/types";
import type {
  DocumentId,
  FieldId,
  FolderId,
  RawFieldId,
  ValueArray,
} from "@storyflow/shared/types";
import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { ServerPackage } from "@storyflow/state";
import { extractRootRecord, getGraph } from "@storyflow/fields-core/graph";
import { createStages } from "../aggregation/stages";
import {
  client,
  sortHistories,
  resetHistory,
} from "../collab-utils/redis-client";
import {
  createRawTemplateFieldId,
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
} from "@storyflow/fields-core/ids";
import { unwrapObjectId, parseDocument } from "@storyflow/db-core/convert";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { getPaths } from "@storyflow/db-core/paths";
import { deduplicate, getImports, getSortedValues } from "./helpers";

const createFetcher =
  (dbName: string) =>
  async (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
    sort?: string[];
  }) => {
    const filters = Object.fromEntries(
      Object.entries(fetchObject.filters ?? {})
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key, value]) => {
          return [`values.${key}`, { $elemMatch: { $in: value } }];
        })
    );

    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection<DBDocumentRaw>("documents")
      .find({
        folder: new ObjectId(fetchObject.folder),
        ...filters,
      })
      .sort({ _id: -1 })
      .limit(fetchObject.limit)
      .toArray();

    return result.map(parseDocument);
  };

export const documents = createRoute({
  sync: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.array(
        z.object({
          folder: z.string(),
          actions: z.array(
            z.union([
              z.object({
                type: z.literal("insert"),
                id: z.string(),
                label: z.string().optional(),
                record: z.record(
                  z.string(),
                  z.object({
                    type: z.string().nullable(),
                    children: z.array(z.any()),
                  })
                ),
              }),
              z.object({
                type: z.literal("remove"),
                id: z.string(),
              }),
            ])
          ),
        })
      );
    },
    async mutation(input, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const getValues = async (
        documentId: DocumentId,
        record: SyntaxTreeRecord,
        getArticles: (ids: DocumentId[]) => Promise<DBDocument[]>
      ) => {
        let computationRecord = extractRootRecord(documentId, record);

        console.log("RECORD", record, computationRecord);

        let graph = getGraph(computationRecord);

        const externalFieldIds = deduplicate(
          Array.from(graph.imports.values()).flat(1)
        ).filter((el) => !isFieldOfDocument(el, documentId)) as FieldId[];

        const externalDocumentIds = externalFieldIds.reduce(
          (acc: DocumentId[], cur) => {
            const docId = getDocumentId(cur as FieldId);
            if (!isNestedDocumentId(docId) && !acc.includes(docId))
              acc.push(docId);
            return acc;
          },
          []
        );

        const importedArticles = await getArticles(externalDocumentIds);

        let importsRecord = getImports(externalFieldIds, importedArticles);

        let fullRecord = { ...importsRecord, ...computationRecord };
        graph = getGraph(fullRecord);

        const result = getSortedValues(fullRecord, graph, {
          returnValuesForDocument: documentId,
        });

        console.log("RESULT", fullRecord, result);

        const timestamp = Date.now();

        const keys = Object.keys(fullRecord).filter((el): el is FieldId =>
          el.startsWith(getRawDocumentId(documentId))
        );

        console.log("KEYS", Object.keys(fullRecord), documentId, keys);

        return Object.assign(result, {
          updated: Object.fromEntries(
            keys.map((el) => [getRawFieldId(el), timestamp])
          ),
        });
      };

      const batchQuery = (() => {
        const collectedIds = new Set<string>();
        const resolvers = new Set<(value: DBDocument[]) => void>();

        const fetch = async () => {
          const array = await db
            .collection<DBDocumentRaw>("documents")
            .find({
              id: {
                $in: Array.from(collectedIds),
              },
            })
            .toArray();
          resolvers.forEach((resolve) =>
            resolve(array.map((el) => parseDocument(el)))
          );
          resolvers.clear();
        };

        return {
          getter: (ids: DocumentId[]): Promise<DBDocument[]> => {
            ids.forEach((id) => collectedIds.add(id));
            return new Promise((resolve) => resolvers.add(resolve));
          },
          fetch,
        };
      })();

      const insertsPromise: Promise<DBDocumentRaw[]> = Promise.all(
        input.reduce(
          (acc, { folder, actions }) =>
            actions.reduce((acc, action) => {
              if (action.type === "insert") {
                const doc: DBDocumentRaw = {
                  _id: new ObjectId(action.id),
                  folder: new ObjectId(folder),
                  versions: { config: 0 },
                  config: [],
                  ...(action.label && { label: action.label }),
                  fields: [],
                  values: {},
                  updated: {},
                  ids: [],
                  cached: [],
                };

                const promise = getValues(
                  action.id as DocumentId,
                  action.record as SyntaxTreeRecord,
                  batchQuery.getter
                ).then((result) => {
                  return { ...doc, ...result };
                });

                acc.push(promise);
              }
              return acc;
            }, acc),
          [] as Promise<DBDocumentRaw>[]
        )
      );

      await batchQuery.fetch();

      const inserts = await insertsPromise;

      const removes: string[] = input.reduce((acc, { folder, actions }) => {
        actions.forEach((action) => {
          if (action.type !== "insert") {
            acc.push(action.id);
          }
        });
        return acc;
      }, [] as string[]);

      // TODO - should not reset. There should be a "null" stage for version history
      try {
        await Promise.all(
          inserts.map(({ _id }) => resetHistory(slug, unwrapObjectId(_id)))
        );
      } catch (err) {
        console.log("ERROR", err);
      }

      /*
      
      */

      /* TODO: mongo 5.1
      db
        .aggregate([
          { $documents: inserts },
          ...createStages([]),
          createUnsetStage(),
          { $merge: "documents" },
        ])
        .next()
        .then(() => ({ acknowledged: true }))
      */

      const result: { acknowledged: boolean }[] = await Promise.all([
        ...(inserts.length
          ? inserts.map((insert) =>
              db.collection<DBDocumentRaw>("documents").updateOne(
                { _id: insert._id },
                [
                  {
                    $set: {
                      _id: insert._id,
                      folder: insert.folder,
                      ...(insert.label && { label: insert.label }),
                      config: { $literal: insert.config },
                      values: { $literal: insert.values },
                      updated: { $literal: insert.updated },
                      fields: { $literal: insert.fields },
                      versions: { $literal: { config: 0 } },
                    },
                  },
                  ...createStages([]),
                ],
                {
                  upsert: true,
                }
              )
            )
          : []),
        ...(removes.length
          ? [
              db.collection<DBDocumentRaw>("documents").deleteMany({
                _id: { $in: removes.map((el) => new ObjectId(el)) },
              }),
            ]
          : []),
        ...(removes.length
          ? [
              client
                .del(...removes.map((id) => `${slug}:${id}`))
                .then((number) => ({
                  acknowledged: number === removes.length,
                })),
            ]
          : []),
      ]);

      /**
       * TODO: Should run updates since references can be made before save
       */

      return success(
        result.every((el) =>
          typeof el === "number" ? el === removes.length : el.acknowledged
        )
      );
    },
  }),

  getList: createProcedure({
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
    async query({ folder, filters, limit, sort }, { slug, dbName }) {
      const documents = await createFetcher(dbName!)({
        folder: folder as FolderId,
        filters: filters as Record<FieldId, ValueArray>,
        limit,
        sort,
      });

      const historiesRecord: Record<
        DocumentId,
        Record<string, ServerPackage<any>[]>
      > = Object.fromEntries(
        await Promise.all(
          documents.map(async ({ _id }) => {
            const pkgs = (await client.lrange(
              `${slug}:${_id}`,
              0,
              -1
            )) as ServerPackage<any>[];
            return [_id, sortHistories(pkgs)];
          })
        )
      );

      return success({
        documents: documents,
        historiesRecord,
      });
    },
  }),

  getByLabel: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async query(string, { dbName }) {
      const db = (await clientPromise).db(dbName);

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

      /*
      const frontIndex = articles.findIndex((el) => el.label === "__front__");

      if (frontIndex < 0) {
        return success({
          front: null,
          articles,
        });
      }

      const [front] = articles.splice(frontIndex, 1);
      */

      return success(articles);
    },
  }),

  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async query(id, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const documentRaw = await db
        .collection<DBDocumentRaw>("documents")
        .findOne({ _id: new ObjectId(id) });

      if (!documentRaw) {
        return error({ message: "No article found" });
      }

      const doc = parseDocument(documentRaw);

      const histories = sortHistories(
        (await client.lrange(
          `${slug}:${doc._id}`,
          0,
          -1
        )) as ServerPackage<any>[]
      );

      return success({
        doc,
        histories,
      });
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
    async query({ namespace }, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const lastBuildCounter =
        (
          await db
            .collection<{ name: string; counter: number }>("counters")
            .findOne({
              name: "build",
            })
        )?.counter ?? 0;

      const folder = new ObjectId(namespace);

      /*
      ...(namespace
        ? { folder: new ObjectId(namespace) }
        : {
            [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
              $exists: true,
            },
          }),
      /*
      [`values.${URL_ID}`]: namespace
        ? { $regex: `^${namespace}` }
        : { $exists: true },
      */

      const docs = await db
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespace
            ? { folder: new ObjectId(namespace) }
            : {
                [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
                  $exists: true,
                },
              }),
          /*
          $or: [
            {
              folder,
              [`updated.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
                $gt: lastBuildCounter,
              },
            },
            {
              folder,
              [`updated.${createRawTemplateFieldId(DEFAULT_FIELDS.label.id)}`]:
                { $gt: lastBuildCounter },
            },
            {
              folder,
              [`updated.${createRawTemplateFieldId(DEFAULT_FIELDS.page.id)}`]: {
                $gt: lastBuildCounter,
              },
            },
            {
              folder,
              [`updated.${createRawTemplateFieldId(DEFAULT_FIELDS.layout.id)}`]:
                { $gt: lastBuildCounter },
            },
          ],
          */
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
        const url = el.values[fields[1]][0] as string;
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

  revalidated: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async mutation(_, { dbName }) {
      const db = (await clientPromise).db(dbName);

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
