import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DocumentId,
  ComputationBlock,
  Computation,
  Value,
  FieldId,
  ComputationRecord,
  ValueRecord,
  DBDocumentRaw,
  NestedDocumentId,
  RawDocumentId,
  RawFieldId,
} from "@storyflow/backend/types";
import { ObjectId, WithId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import {
  filterServerPackages,
  ServerPackage,
  unwrapServerPackage,
} from "@storyflow/state";
import { setFieldConfig } from "shared/getFieldConfig";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import { AnyOp, targetTools } from "shared/operations";
import { getConfig } from "shared/initialValues";
import {
  ComputationGraph,
  createComputationTransformer,
  extractRootRecord,
  getComputationEntries,
  getComputationRecord,
  getFieldRecord,
  getGraph,
} from "shared/computation-tools";
import { modifyNestedChild } from "@storyflow/backend/traverse";
import {
  getImportIds,
  getNextState,
  getPickedDocumentIds,
} from "shared/computation-tools";
import { createStages, Update } from "../aggregation/stages";
import util from "util";
import { symb } from "@storyflow/backend/symb";
import {
  ZodServerPackage,
  ZodDocumentOp,
  ZodToggle,
  ZodSplice,
} from "../collab-utils/zod";
import {
  client,
  getHistoriesFromIds,
  sortHistories,
  resetHistory,
  modifyValues,
} from "../collab-utils/redis-client";
import {
  computeFieldId,
  getDocumentId,
  getRawDocumentId,
  getRawFieldId,
  isFieldOfDocument,
  isNestedDocumentId,
  isTemplateField,
  unwrapObjectId,
} from "@storyflow/backend/ids";
import { FIELDS } from "@storyflow/backend/fields";

const parseDocument = (raw: DBDocumentRaw): DBDocument => {
  const { _id, folder, ids, cached, compute, ...rest } = raw;
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
      return z.record(
        z.string(), // document
        z.record(
          z.string(), // key
          ZodServerPackage(
            z.union([
              ZodDocumentOp(ZodToggle(z.any())),
              ZodDocumentOp(ZodSplice(z.any())),
            ])
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

  getList: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async query(folder, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const articles = (
        (await db
          .collection<DBDocumentRaw>("documents")
          .find({ folder: new ObjectId(folder) })
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

      return success({
        articles,
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
        .collection("documents")
        .findOne<WithId<DBDocumentRaw>>({ id });

      if (!documentRaw) {
        return error({ message: "No article found " });
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

  getListFromFilters: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        filters: z.array(
          z.object({
            field: z.string(),
            operation: z.union([
              z.literal("="),
              z.literal("!="),
              z.literal(">"),
              z.literal("<"),
              z.literal(">="),
              z.literal("<="),
            ]),
            value: z.any(),
          })
        ),
      });
    },
    async query({ filters: filtersProp }, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const filters = filtersProp.reduce((acc, filter) => {
        const operator = {
          "=": "eq",
          "!=": "ne",
          ">": "gt",
          "<": "lt",
          ">=": "gte",
          "<=": "lte",
        };
        const field =
          filter.field === "folder" ? "folder" : `values.${filter.field}`;
        acc[field] = {
          [`$${operator[filter.operation]}`]:
            filter.value.length === 1 ? filter.value[0] : filter.value,
        };
        return acc;
      }, {} as Record<string, { [key: string]: any[] }>);

      const result = await db
        .collection("documents")
        .find<WithId<DBDocumentRaw>>(filters)
        .sort({ _id: -1 })
        .toArray();

      console.log(filters, result);

      return success(
        result.map((el) => ({
          id: el._id.toHexString(),
          values: el.values,
        }))
      );
    },
  }),

  listOperation: createProcedure({
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
                record: z.record(z.string(), z.array(z.any())),
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
        record: ComputationRecord,
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

        return getSortedValues(fullRecord, graph, {
          returnValuesForDocument: documentId,
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
                  versions: {},
                  config: [],
                  ...(action.label && { label: action.label }),
                  compute: [],
                  values: {},
                  ids: [],
                  cached: [],
                };

                const promise = getValues(
                  action.id as DocumentId,
                  action.record,
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
          inserts.map(({ _id }) =>
            resetHistory(slug, getRawDocumentId(unwrapObjectId(_id)))
          )
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
                      compute: { $literal: insert.compute },
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
          ? [db.collection("documents").deleteMany({ id: { $in: removes } })]
          : []),
        client
          .del(...removes)
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

  save: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        id: z.string(),
        searchable: z.record(z.record(z.boolean())),
      });
    },
    async mutation(input, { dbName, slug }) {
      const documentId = input.id as DocumentId;
      const rawArticleId = getRawDocumentId(documentId);
      const searchable = input.searchable;

      const db = (await clientPromise).db(dbName);

      const [article, histories] = await Promise.all([
        db
          .collection<DBDocumentRaw>("documents")
          .findOne({ _id: new ObjectId(documentId) }),
        (
          client.lrange(
            `${slug}:${getRawDocumentId(documentId)}`,
            0,
            -1
          ) as Promise<ServerPackage<any>[]>
        ).then((res) => sortHistories(res)),
        // clientConfig
      ]);

      console.log(
        "history",
        util.inspect(histories, { depth: null, colors: true })
      );

      if (!article) {
        return error({ message: "No article found" });
      }

      let documentConfig = article.config;

      /*
      IMPORTANT ASSUMPTION 1
      We do NOT know the values of the document's imports (even though they are stored in the document).
      We need to fetch them first.
      The catch: we cannot fetch all imports in the first pass, since some import
      ids are computed from other imports (with "pick" function).
      */

      const computationRecord = extractRootRecord(
        documentId,
        getComputationRecord(documentId, article)
      );

      // TODO delete own fields from computationRecord that are not in documentConfig.

      const updatedFieldsIds: Set<FieldId> = new Set();

      const versions = article.versions ?? {};

      (
        Object.entries(histories) as [
          RawDocumentId | RawFieldId,
          ServerPackage<any>[]
        ][]
      ).map(([id, history]) => {
        if (id === rawArticleId) {
          const templateVersion = article.versions?.[rawArticleId] ?? 0;
          const pkgs = filterServerPackages(templateVersion, history);
          documentConfig = transformDocumentConfig(documentConfig, pkgs);
          versions[rawArticleId] = templateVersion + pkgs.length;
          return;
        }

        const fieldId = computeFieldId(documentId, id as RawFieldId);

        const initialValue: Computation | undefined =
          computationRecord[fieldId];

        const fieldVersion = article.versions?.[id] ?? 0;
        const pkgs = filterServerPackages(fieldVersion, history);

        if (pkgs.length > 0) {
          const value = transformField(initialValue, pkgs);
          computationRecord[fieldId] = value;
          updatedFieldsIds.add(fieldId);
          versions[id] = fieldVersion + pkgs.length;
        }
      });

      let graph = getGraph(computationRecord);

      console.log("GRAPH", util.inspect(graph, { depth: null, colors: true }));

      const externalFieldIds = deduplicate(
        Array.from(graph.imports.values()).flat(1)
      ).filter((id) => !isFieldOfDocument(id, documentId)) as FieldId[];

      const getDocumentIds = (fieldIds: FieldId[]) => {
        return fieldIds.reduce((acc: DocumentId[], cur) => {
          const docId = getDocumentId(cur);
          if (!isNestedDocumentId(docId) && !acc.includes(docId))
            acc.push(docId);
          return acc;
        }, []);
      };

      const externalDocumentIds = getDocumentIds(externalFieldIds);

      const drefs: DocumentId[] = [];

      // we need to consider drefs for two purposes:
      // a) an updated field might resolve to a dref in which case an external import of the field
      //    could run a "pick" on it, and we need the drefs to create derivatives.
      // b) the updated field runs a "pick" on an import itself, and we need to fetch
      //    the picked field. Things to take into account:
      //    a) If it picks from an internal field, the ids have been found through flatten().
      //    b) If it picks from an external field, we cannot obtain the dref before we have fetched the external field.

      // Before fetching imports, we can handle:
      // 1) the updated fields that resolve to drefs should be used to produce derivatives

      // After fetching imports, we can handle:
      // 1') the updated fields that resolve to drefs should be used to produce derivatives
      // 2) the updated fields that picks from an external field should be used to produce field import ids.

      updatedFieldsIds.forEach((fieldId) => {
        // even though we are not concerned with picked document ids,
        // we can use the same function to get drefs
        drefs.push(...getPickedDocumentIds(fieldId, computationRecord));
      });

      drefs.forEach((ref) => {
        if (!externalDocumentIds.includes(ref)) {
          externalDocumentIds.push(ref);
        }
      });

      console.log("EXTERNAL", externalDocumentIds);

      const importedArticlesRaw = await db
        .collection<DBDocumentRaw>("documents")
        .find({
          _id: {
            $in: externalDocumentIds.map((el) => new ObjectId(el)),
          },
        })
        .toArray();

      const importedArticles = importedArticlesRaw.map((el) =>
        Object.assign(parseDocument(el), { values: el.values })
      );

      let importsRecord = getImports(externalFieldIds, importedArticles);

      // second import check

      /*
        TODO: Among the imports of imports, there may be fields from the saved article.
        These are not added since flatten() makes sure it does not add fields that are
        already added. But if it is a deleted field that is not included in the original
        computationRecord, it gets added to the flattenedRecord through the imports.
        This is perhaps the way it should work to ensure consistency. When the imported
        field is computed with the cached value of the deleted field, it should not obtain
        a different value now that it is imported back into the article.
      */

      let fullRecord = { ...importsRecord, ...computationRecord };

      graph = getGraph(fullRecord);

      const newDrefs: DocumentId[] = [];
      const newExternalFieldIds: FieldId[] = [];

      updatedFieldsIds.forEach((fieldId) => {
        // 1')
        getPickedDocumentIds(fieldId, fullRecord).forEach((id) => {
          if (!drefs.includes(id)) {
            newDrefs.push(id);
          }
        });
        // 2)
        const check = [fieldId, ...(graph.children.get(fieldId) ?? [])];
        check.forEach((id, index) => {
          const comp = fullRecord[id];
          if (!comp) return;
          comp.forEach((el) => {
            if (index > 0 && symb.isDBSymbol(el, "p")) {
              const prev = comp[index - 1];
              if (symb.isNestedField(prev)) {
                const drefs = getPickedDocumentIds(prev.field, fullRecord);
                drefs.forEach((dref) => {
                  const newFieldId = computeFieldId(dref, el.p);
                  if (!externalFieldIds.includes(newFieldId)) {
                    newExternalFieldIds.push(newFieldId);
                  }
                });
              }
            }
          });
        });
      });

      const newExternalDocumentIds = [
        ...getDocumentIds(newExternalFieldIds),
        ...newDrefs,
      ].filter((el) => !externalDocumentIds.includes(el));

      if (newExternalDocumentIds.length) {
        await db
          .collection<DBDocumentRaw>("documents")
          .find({
            id: {
              $in: newExternalDocumentIds,
            },
          })
          .forEach((doc) => {
            importedArticles.push(
              Object.assign(parseDocument(doc), { values: doc.values })
            );
          });
      }

      if (newExternalFieldIds) {
        let extraImportsRecord = getImports(
          newExternalFieldIds,
          importedArticles
        );
        fullRecord = { ...fullRecord, ...extraImportsRecord };
        graph = getGraph(fullRecord);
      }

      const drefArticles = importedArticles.filter(
        (doc) => drefs.includes(doc._id) || newDrefs.includes(doc._id)
      );

      const { compute, values } = getSortedValues(fullRecord, graph, {
        returnValuesForDocument: documentId,
      });

      const derivatives: Update[] = [];

      drefArticles.forEach((doc) => {
        (Object.keys(doc.record) as FieldId[])
          .filter((el) => isFieldOfDocument(el, doc._id))
          .forEach((id) => {
            if (!isTemplateField(id)) return;
            const value = doc.record[id];
            const _imports = getFieldBlocksWithDepths(id, doc.record);
            derivatives.push({
              id: new ObjectId(id),
              depth: 0,
              value,
              result: doc.values[getRawFieldId(id)],
              // it does exist in values because template field values are always saved to values
              _imports,
              imports: [], // should just be empty
            });
          });
      });

      console.log(
        "DERIVATIVES",
        util.inspect(
          derivatives.map((el) => ({
            ...el,
            value: [],
          })),
          { depth: null, colors: true }
        )
      );

      const cached: FieldId[] = [];
      updatedFieldsIds.forEach((id) => {
        if (!(id in values) && !isTemplateField(id)) {
          cached.push(id);
        }
      });

      const result1 = await db
        .collection<DBDocumentRaw>("documents")
        .findOneAndUpdate(
          { _id: new ObjectId(documentId) },
          [
            {
              $set: {
                values: { $literal: values }, // uses $literal to do hard replace (otherwise: merges old with new values)
                compute,
                config: documentConfig,
                versions,
                cached: cached as any,
              },
            },
            ...createStages([], derivatives, { cache: Boolean(cached.length) }),
          ],
          {
            returnDocument: "after",
          }
        );

      if (result1.ok) {
        const doc = result1.value!;
        // includes imports by default
        const record = parseDocument(doc).record;
        const cachedValues = doc!.cached;
        const cachedRecord: Record<FieldId, Value[]> = Object.fromEntries(
          cached.map((id, index) => [id, cachedValues[index]])
        );

        // create updates

        const updates: Update[] = Array.from(updatedFieldsIds, (id) => {
          const value = record[id];
          const _imports = getFieldBlocksWithDepths(id, record);
          return {
            id: new ObjectId(id),
            depth: 0,
            value,
            result: doc.values[getRawFieldId(id)] ?? cachedRecord[id] ?? [],
            _imports,
            imports: [], // should just be empty
          };
        });

        console.log(
          "UPDATES",
          util.inspect(
            updates.map((el) => el.imports),
            { depth: null, colors: true }
          )
        );

        /*
        I could first find the articles and in the update stage use the article ids
        then I could send urls back to the client for revalidation.
        */

        await db.collection("documents").updateMany(
          {
            "compute.id": { $in: updates.map((el) => el.id) },
            _id: { $ne: new ObjectId(documentId) },
          },
          [...createStages(updates, derivatives)]
        );

        await resetHistory(slug, getRawDocumentId(documentId));

        return success(parseDocument(result1.value!));
      }

      return error({ message: "did not succeed" });
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

const deduplicate = <T>(arr: T[]): T[] => Array.from(new Set(arr));

const getImports = (
  importIds: FieldId[],
  importedArticles: DBDocument[]
): ComputationRecord => {
  const record: ComputationRecord = {};

  importIds.forEach((id) => {
    const article = importedArticles.find((el) => el._id === getDocumentId(id));
    if (article) {
      const record = article.record;
      const value = record[id];
      if (value) {
        Object.assign(record, getFieldRecord(record, id, getGraph(record)));
        return;
      }
    }
    record[id] = [];
  });

  return record;
};

function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph
): { compute: ComputationBlock[] };
function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    keepDepths: true;
  }
): { compute: (ComputationBlock & { depth: number })[] };
function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    returnValuesForDocument: DocumentId;
  }
): { values: ValueRecord; compute: ComputationBlock[] };
function getSortedValues(
  record: ComputationRecord,
  graph: ComputationGraph,
  options: {
    returnValuesForDocument?: DocumentId;
    keepDepths?: boolean;
  } = {}
): {
  values?: ValueRecord;
  compute: (ComputationBlock & { depth?: number })[];
} {
  let computeWithDepth: (ComputationBlock & { depth: number })[] = [];
  let values: ValueRecord = {};

  const isPrimitive = (
    computation: Computation
  ): computation is (string | boolean | number | Date)[] => {
    return computation.every(
      (el) =>
        ["string", "boolean", "number"].includes(typeof el) ||
        el instanceof Date
    );
  };

  const depthCache = new Map<FieldId, number>();

  const getDepth = (id: FieldId): number => {
    // 0 is result if field.imports === 0
    const cached = depthCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const importers: FieldId[] = [];

    graph.imports.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    graph.children.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    const result = Math.max(-1, ...importers.map(getDepth)) + 1;
    depthCache.set(id, result);
    return result;
  };

  getComputationEntries(record).map(([fieldId, value]) => {
    if (
      isPrimitive(value) &&
      getDocumentId(fieldId) === options.returnValuesForDocument
    ) {
      values[getRawFieldId(fieldId)] = value;
    } else {
      computeWithDepth.push({
        id: new ObjectId(fieldId),
        value,
        depth: getDepth(fieldId),
      });
    }
  });

  // SORT BY AND REMOVE DEPTH
  computeWithDepth.sort((a, b) => b.depth - a.depth);

  if (!options.keepDepths) return { compute: computeWithDepth };

  const compute = computeWithDepth.map(({ depth, ...el }) => el);

  if (!options.returnValuesForDocument) return { compute };

  return { values, compute };
}

const transformField = (
  initialValue: Computation | undefined,
  pkgs: ServerPackage<AnyOp>[]
): Computation => {
  const getType = () => {
    if (!pkgs.length) return null;
    const operation = unwrapServerPackage(pkgs[0]).operations[0];
    return targetTools.parse(operation.target).field;
  };

  const type = getType();

  if (!type || type === "any") {
    return initialValue ?? [];
  }

  const isType = <T extends typeof type>(
    value: string,
    type: T
  ): value is T => {
    return value === type;
  };

  const getData = (type: string) => {
    if (
      isType(type, "default") ||
      isType(type, "url") ||
      isType(type, "slug")
    ) {
      return getConfig(type).initialValue;
    }
    return null;
  };

  const defaultValue = initialValue ?? getData(type);

  if (defaultValue === null) {
    return initialValue ?? [];
  }

  const transformer = createComputationTransformer(defaultValue);

  let value = defaultValue;

  let transform = getConfig(type).transform;

  transformer(pkgs).forEach((pkg) => {
    unwrapServerPackage(pkg).operations.forEach((operation) => {
      const { input, location } = targetTools.parse(operation.target);
      if (location === "") {
        value = decodeEditorComputation(
          getNextState(encodeEditorComputation(value, transform), operation),
          transform
        );
      } else {
        const path = targetTools.getLocation(operation.target);
        const result = modifyNestedChild(value, path.split("."), (value) => {
          const encoded = encodeEditorComputation(value);
          const transformed = getNextState(encoded, operation);
          const decoded = decodeEditorComputation(transformed);
          return decoded;
        });
        if (result) {
          value = result;
        }
      }
    });
  });

  return value;
};

const transformDocumentConfig = (
  config: DBDocument["config"],
  history: ServerPackage<AnyOp>[]
) => {
  let newConfig = [...config];

  history.forEach((pkg) => {
    unwrapServerPackage(pkg).operations.forEach((operation) => {
      if (targetTools.isOperation(operation, "document-config")) {
        operation.ops.forEach((action) => {
          const { index, insert, remove } = action;
          newConfig.splice(index, remove ?? 0, ...(insert ?? []));
        });
      } else if (targetTools.isOperation(operation, "property")) {
        const fieldId = targetTools.getLocation(operation.target) as FieldId;
        operation.ops.forEach((action) => {
          newConfig = setFieldConfig(newConfig, fieldId, (ps) => ({
            ...ps,
            [action.name]: action.value,
          }));
        });
      }
    });
  });

  return newConfig;
};

const getFieldBlocksWithDepths = (
  fieldId: FieldId,
  record: ComputationRecord
) => {
  const blocks: ComputationBlock[] = getComputationEntries(record).map(
    ([id, value]) => ({ id: new ObjectId(id), value })
  );

  const graph = getGraph(record);

  const fieldRecord = getFieldRecord(record, fieldId, graph);

  const { compute } = getSortedValues(fieldRecord, graph, { keepDepths: true });

  return compute;
};
