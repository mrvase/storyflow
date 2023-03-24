import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DocumentId,
  FieldId,
  DBDocumentRaw,
  SyntaxTreeRecord,
} from "@storyflow/backend/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { ServerPackage } from "@storyflow/state";
import {
  extractRootRecord,
  getComputationRecord,
  getGraph,
} from "shared/computation-tools";
import { createStages } from "../aggregation/stages";
import {
  client,
  sortHistories,
  resetHistory,
} from "../collab-utils/redis-client";
import {
  getDocumentId,
  isFieldOfDocument,
  isNestedDocumentId,
  unwrapObjectId,
} from "@storyflow/backend/ids";
import { FIELDS } from "@storyflow/backend/fields";
import { deduplicate, getImports, getSortedValues } from "./helpers";

export const parseDocument = (raw: DBDocumentRaw): DBDocument => {
  const { _id, folder, ids, cached, fields, ...rest } = raw;
  const id = unwrapObjectId(raw._id);
  return {
    _id: id,
    folder: unwrapObjectId(raw.folder),
    record: getComputationRecord(id, raw),
    ...rest,
  };
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

        return result;
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
                      fields: { $literal: insert.fields },
                      versions: { $literal: {} },
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
        client
          .del(...removes.map((id) => `${slug}:${id}`))
          .then((number) => ({ acknowledged: number === removes.length })),
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
        sort: z
          .record(z.string(), z.union([z.literal(-1), z.literal(1)]))
          .optional(),
        limit: z.number(),
        filters: z.record(z.string(), z.any()).optional(),
      });
    },
    async query({ folder, filters: filtersProp, limit }, { slug, dbName }) {
      const db = (await clientPromise).db(dbName);

      const filters = Object.fromEntries(
        Object.entries(filtersProp ?? {}).map(([key, value]) => {
          return [`values.${key}`, value];
        })
      );

      const result = await db
        .collection<DBDocumentRaw>("documents")
        .find({ folder: new ObjectId(folder), ...filters })
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();

      const articles = result.map(parseDocument);

      const historiesRecord: Record<
        DocumentId,
        Record<string, ServerPackage<any>[]>
      > = Object.fromEntries(
        await Promise.all(
          articles.map(async ({ _id }) => {
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
        articles,
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
            [`values.${FIELDS.label.id}`]: { $regex: string, $options: "i" },
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

  revalidate: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        namespace: z.string().optional(),
        domain: z.string(),
        revalidateUrl: z.string(),
      });
    },
    async query({ namespace, domain, revalidateUrl }, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const lastBuildCounter = await db
        .collection<{ name: string; counter: number }>("counters")
        .findOneAndUpdate(
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
            returnDocument: "before",
          }
        );

      const lastBuild = lastBuildCounter?.value?.counter ?? 0;

      const articles = await db
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespace
            ? { folder: new ObjectId(namespace) }
            : { [`values.${FIELDS.url.id}`]: { $exists: true } }),
          /*
          [`values.${URL_ID}`]: namespace
            ? { $regex: `^${namespace}` }
            : { $exists: true },
          */
        })
        .toArray();

      const urls = articles.map((el) => el.values[FIELDS.url.id][0] as string);

      console.log("REVALIDATE", urls);

      // const paths = urls.map((el) => `/${el.replace("://", "").split("/")[1]}`);

      /*
      const result = await fetch(revalidateUrl, {
        body: JSON.stringify(urls),
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      */

      return success(urls);

      // check update timestamp
    },
  }),
});
