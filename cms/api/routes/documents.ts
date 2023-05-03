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
import { clientPromise } from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { createRawTemplateFieldId } from "@storyflow/fields-core/ids";
import { parseDocument } from "@storyflow/db-core/convert";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { getPaths } from "@storyflow/db-core/paths";
import { createObjectId } from "@storyflow/db-core/mongo";

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
        folder: createObjectId(fetchObject.folder),
        ...filters,
      })
      .sort({ _id: -1 })
      .limit(fetchObject.limit)
      .toArray();

    return result.map(parseDocument);
  };

export const documents = createRoute({
  /*
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

        const timestamp = Date.now();

        const keys = Object.keys(fullRecord).filter((el): el is FieldId =>
          el.startsWith(getRawDocumentId(documentId))
        );

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
                  _id: createObjectId(action.id),
                  folder: createObjectId(folder),
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

      // TODO: mongo 5.1
      // db
      // .aggregate([
      //   { $documents: inserts },
      //   ...createStages([]),
      //   createUnsetStage(),
      //   { $merge: "documents" },
      // ])
      // .next()
      // .then(() => ({ acknowledged: true }))

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
                _id: { $in: removes.map((el) => createObjectId(el)) },
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

      // TODO: Should run updates since references can be made before save

      return success(
        result.every((el) =>
          typeof el === "number" ? el === removes.length : el.acknowledged
        )
      );
    },
  }),
  */

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

      return success(documents);
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

      const docs = await db
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespace
            ? { folder: createObjectId(namespace) }
            : {
                [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
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

  deleteMany: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.array(z.string());
    },
    async mutation(ids, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

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
