import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DocumentId,
  ComputationBlock,
  Computation,
  Value,
  FlatComputation,
  FieldId,
  ComputationRecord,
  ValueRecord,
  EditorComputation,
  FlatComputationRecord,
  TemplateFieldId,
  NonNestedComputation,
  SearchableProps,
} from "@storyflow/backend/types";
import { ModifyResult, ObjectId, WithId } from "mongodb";
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
import { createComputationTransformer } from "shared/computation-tools";
import { modifyNestedChild } from "@storyflow/backend/traverse";
import {
  getImportIds,
  getNextState,
  getPickedDocumentIds,
} from "shared/computation-tools";
import {
  flattenComputation,
  getChildrenFromFlatComputation,
  getComputationRecord,
  getFlatComputationRecord,
  restoreComputation,
} from "@storyflow/backend/flatten";
import {
  computeFieldId,
  getDocumentId,
  getTemplateFieldId,
  isTemplateField,
  minimizeId,
} from "@storyflow/backend/ids";
import { createStages, Update } from "../aggregation/stages";
import util from "util";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";
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

export const removeObjectId = <T extends { _id: any }>({
  _id,
  ...rest
}: T): Omit<T, "_id"> => rest;

const removeProps = <T extends object, P extends string[]>(
  obj: T,
  ...props: P
): Omit<T, P[number]> => {
  const newObject = { ...obj };
  props.forEach((prop) => {
    if (prop in newObject) {
      delete (newObject as any)[prop];
    }
  });
  return newObject;
};

/*
export const ZodBlock: z.ZodType<ComputationBlock> = z.lazy(() =>
  z.intersection(
    z.object({
      id: z.string(),
      imports: z.array(ZodBlock),
    }),
    z.union([
      z.object({
        compute: z.array(z.any()),
        value: z.null(),
      }),
      z.object({
        value: z.object({
          elements: z.array(z.any()),
        }),
      }),
    ])
  )
);
*/

export const articles = createRoute({
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
          histories = await getHistoriesFromIds(slug, Object.keys(input));
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
        (await db.collection("documents").find({ folder }).toArray()) ?? []
      ).map(removeObjectId) as DBDocument[];

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
          .collection("documents")
          .find({ [`values.${LABEL_ID}`]: { $regex: string, $options: "i" } })
          .toArray()) ?? []
      ).map(removeObjectId) as DBDocument[];

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

      const article = await db
        .collection("documents")
        .findOne<WithId<DBDocument>>({ id });

      if (!article) {
        return error({ message: "No article found " });
      }

      const histories = sortHistories(
        (await client.lrange(
          `${slug}:${article.id}`,
          0,
          -1
        )) as ServerPackage<any>[]
      );

      return success({
        article: removeObjectId(article) as DBDocument,
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
        .find<WithId<DBDocument>>(filters)
        .sort({ _id: -1 })
        .toArray();

      console.log(filters, result);

      return success(
        result.map((el) => ({
          id: el.id,
          values: el.values,
        }))
      );
    },
  }),

  getLabels: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async query(id, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const article = await db
        .collection("documents")
        .findOne<WithId<DBDocument>>({ id });

      if (!article) {
        return error({ message: "No article found" });
      }

      return success({});
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
                values: z.record(z.string(), z.array(z.any())),
                compute: z.array(
                  z.object({ id: z.string(), value: z.array(z.any()) })
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
        id: string,
        record: ComputationRecord,
        getArticles: (ids: DocumentId[]) => Promise<DBDocument[]>
      ) => {
        let flatData = flatten(record, {});

        const externalFieldIds = deduplicate(
          Array.from(flatData.importMap.values()).flat(1)
        ).filter((el) => !el.startsWith(id)) as FieldId[];

        const externalDocumentIds = externalFieldIds.reduce(
          (acc: DocumentId[], cur) => {
            const docId = getDocumentId(cur as FieldId);
            if (!acc.includes(docId)) acc.push(docId);
            return acc;
          },
          []
        );

        const importedArticles = await getArticles(externalDocumentIds);

        let importsRecord = getImports(externalFieldIds, importedArticles);

        flatData = flatten(importsRecord, {}, flatData);

        return getSortedValues(id as DocumentId, flatData);
      };

      const batchQuery = (() => {
        const collectedIds = new Set<string>();
        const resolvers = new Set<(value: DBDocument[]) => void>();

        const fetch = async () => {
          const array = await db
            .collection("documents")
            .find<WithId<DBDocument>>({
              id: {
                $in: Array.from(collectedIds),
              },
            })
            .toArray();
          resolvers.forEach((resolve) => resolve(array));
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

      const insertsPromise: Promise<DBDocument[]> = Promise.all(
        input.reduce(
          (acc, { folder, actions }) =>
            actions.reduce((acc, action) => {
              if (action.type === "insert") {
                const doc: DBDocument = {
                  id: action.id as DocumentId,
                  folder,
                  versions: {},
                  config: [],
                  ...(action.label && { label: action.label }),
                  compute: action.compute as ComputationBlock[],
                  values: action.values,
                };

                const record = getComputationRecord(doc);

                const promise = getValues(
                  action.id,
                  record,
                  batchQuery.getter
                ).then((values) => {
                  return { ...doc, ...values };
                });

                acc.push(promise);
              }
              return acc;
            }, acc),
          [] as Promise<DBDocument>[]
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
        await Promise.all(inserts.map(({ id }) => resetHistory(slug, id)));
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
              db.collection("documents").updateOne(
                { id: insert.id },
                [
                  {
                    $set: {
                      id: insert.id,
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

  create: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.array(
        z.object({
          id: z.string(),
          folder: z.string(),
        })
      );
    },
    async mutation(input, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      // let shortId = input.shortId ?? (await getShortIds("documents", 1, db))[0];

      const articles: DBDocument[] = input.map((article) => ({
        ...article,
        id: article.id as DocumentId,
        config: [],
        values: {},
        compute: [],
        imports: [],
        versions: {},
      }));

      try {
        await Promise.all(articles.map(({ id }) => resetHistory(slug, id)));
      } catch (err) {
        console.log("ERROR", err);
      }

      const result = await db.collection("documents").insertMany(articles);

      return success(result.acknowledged);
    },
  }),

  delete: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async mutation(_id, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const result = await db
        .collection("documents")
        .deleteOne({ _id: new ObjectId(_id) });

      if (!result.acknowledged) {
        return error({ message: "Update failed.", status: 500 });
      }

      return success(null);
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
    async mutation({ id, searchable }, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const [article, histories] = await Promise.all([
        db.collection("documents").findOne({ id }) as Promise<
          WithId<DBDocument>
        >,
        (
          client.lrange(`${slug}:${id}`, 0, -1) as Promise<ServerPackage<any>[]>
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

      const computationRecord = getComputationRecord(article);

      // TODO delete own fields from computationRecord that are not in documentConfig.

      const updatedFieldsIds: Set<FieldId> = new Set();

      const versions = article.versions ?? {};

      Object.entries(histories).map(([id, history]) => {
        if (id === article.id) {
          const templateVersion = article.versions?.[article.id] ?? 0;
          const pkgs = filterServerPackages(templateVersion, history);
          documentConfig = transformDocumentConfig(documentConfig, pkgs);
          versions[article.id] = templateVersion + pkgs.length;
          return;
        }

        const fieldId = `${article.id}${id}` as FieldId;

        const initialValue: Computation | undefined =
          computationRecord[fieldId];

        const fieldVersion = article.versions?.[id as TemplateFieldId] ?? 0;
        const pkgs = filterServerPackages(fieldVersion, history);

        if (pkgs.length > 0) {
          const value = transformField(initialValue, pkgs);
          computationRecord[fieldId] = value;
          updatedFieldsIds.add(fieldId);
          versions[id as TemplateFieldId] = fieldVersion + pkgs.length;
        }
      });

      let flatData = flatten(computationRecord, searchable);

      console.log(
        "FLAT DATA",
        util.inspect(flatData, { depth: null, colors: true })
      );

      const externalFieldIds = deduplicate(
        Array.from(flatData.importMap.values()).flat(1)
      ).filter((el) => !el.startsWith(id)) as FieldId[];

      const getDocumentIds = (fieldIds: FieldId[]) => {
        return fieldIds.reduce((acc: DocumentId[], cur) => {
          const docId = getDocumentId(cur);
          if (!acc.includes(docId)) acc.push(docId);
          return acc;
        }, []);
      };

      const externalDocumentIds = getDocumentIds(externalFieldIds);

      /*
      const isPureDocumentField = (comp: FlatComputation, imports:) => {
        let pure = Boolean(comp.length);
        let decided = false;
        let imports = [];
  
        comp.forEach((el) => {
          if (el === null || typeof el !== "object" || "type" in el) {
            pure = false;
          } else if ("fref" in el) {
            imports.push(el.fref);
          } else if ("dref" in el) {
            decided = true;
          }
        });

        if (pure && !decided && imports.length) {
          return imports.every((id) => isPureDocumentField())
        }
      }
      */

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
        drefs.push(...getPickedDocumentIds(fieldId, flatData.record));
      });

      drefs.forEach((ref) => {
        if (!externalDocumentIds.includes(ref)) {
          externalDocumentIds.push(ref);
        }
      });

      console.log("EXTERNAL", externalDocumentIds);

      const importedArticles = await db
        .collection("documents")
        .find<WithId<DBDocument>>({
          id: {
            $in: externalDocumentIds,
          },
        })
        .toArray();

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

      flatData = flatten(importsRecord, searchable, flatData);

      const newDrefs: DocumentId[] = [];
      const newExternalFieldIds: FieldId[] = [];

      updatedFieldsIds.forEach((fieldId) => {
        // 1')
        getPickedDocumentIds(fieldId, flatData.record).forEach((id) => {
          if (!drefs.includes(id)) {
            newDrefs.push(id);
          }
        });
        // 2)
        const check = [fieldId, ...(flatData.nestedMap.get(fieldId) ?? [])];
        check.forEach((id, index) => {
          const comp = flatData.record[id];
          if (!comp) return;
          comp.forEach((el) => {
            if (index > 0 && symb.isDBSymbol(el, "p")) {
              const prev = comp[index - 1];
              if (symb.isFieldImport(prev)) {
                const drefs = getPickedDocumentIds(prev.fref, flatData.record);
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
          .collection("documents")
          .find<WithId<DBDocument>>({
            id: {
              $in: newExternalDocumentIds,
            },
          })
          .forEach((doc) => {
            importedArticles.push(doc);
          });
      }

      if (newExternalFieldIds) {
        let extraImportsRecord = getImports(
          newExternalFieldIds,
          importedArticles
        );
        flatData = flatten(extraImportsRecord, searchable, flatData);
      }

      const drefArticles = importedArticles.filter(
        (doc) => drefs.includes(doc.id) || newDrefs.includes(doc.id)
      );

      const { compute, values } = getSortedValues(id as DocumentId, flatData);

      const derivatives: Update[] = [];

      drefArticles.forEach((doc) => {
        const record = getFlatComputationRecord(doc);
        Object.keys(record)
          .filter((el): el is FieldId => el.startsWith(doc.id))
          .forEach((id) => {
            if (!isTemplateField(id)) return;
            const value = record[id];
            const _imports = deduplicateWithMaxDepth(
              getFlatImportsWithDuplicates(value, record)
            );
            derivatives.push({
              id,
              depth: 0,
              value,
              result: doc.values[getTemplateFieldId(id)],
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

      const result1 = (await db.collection("documents").findOneAndUpdate(
        { id },
        [
          {
            $set: {
              values: { $literal: values }, // uses $literal to do hard replace (otherwise: merges old with new values)
              compute,
              config: documentConfig,
              versions,
              cached,
            },
          },
          ...createStages([], derivatives, { cache: Boolean(cached.length) }),
        ],
        {
          returnDocument: "after",
        }
      )) as unknown as ModifyResult<DBDocument>;

      if (result1.ok) {
        const doc = result1.value!;
        // includes imports by default
        const record = getFlatComputationRecord(doc);
        const cachedValues = (doc as typeof doc & {
          cached: Value[][];
        })!.cached;
        const cachedRecord: ValueRecord<FieldId> = Object.fromEntries(
          cached.map((id, index) => [id, cachedValues[index]])
        );

        // create updates

        const updates: Update[] = Array.from(updatedFieldsIds, (id) => {
          const value = record[id];
          const _imports = deduplicateWithMaxDepth(
            getFlatImportsWithDuplicates(value, record)
          );
          return {
            id,
            depth: 0,
            value,
            result:
              doc.values[getTemplateFieldId(id)] ?? cachedRecord[id] ?? [],
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
            id: { $ne: id },
          },
          [...createStages(updates, derivatives)]
        );

        await resetHistory(slug, id);

        return success(removeObjectId(result1.value!) as DBDocument);
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
        .collection("documents")
        .find({
          ...(namespace
            ? { folder: minimizeId(namespace) }
            : { [`values.${URL_ID}`]: { $exists: true } }),
          /*
          [`values.${URL_ID}`]: namespace
            ? { $regex: `^${namespace}` }
            : { $exists: true },
          */
        })
        .toArray();

      const urls = articles.map((el) => el.values[URL_ID][0] as string);

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
    const article = importedArticles.find((el) => el.id === getDocumentId(id));
    if (article) {
      const fields = getComputationRecord(article, { includeImports: true });
      const value = fields[id];
      if (value) {
        const addImport = (id: FieldId, value: Computation) => {
          record[id] = value;

          // handle its own imports
          getImportIds(value, fields).forEach((importId) => {
            if (importId in record) return;
            if (importId.startsWith(article.id)) {
              addImport(importId, fields[importId]);
            } else {
              const block = article.compute.find((el) => el.id === importId)!;
              // elements used for restoration are all in imports
              const value = restoreComputation(block.value, article.compute);
              addImport(importId, value);
            }
          });
        };

        addImport(id, value);
        return;
      }
    }

    record[id] = [];
  });

  return record;
};

type FlatData = {
  record: FlatComputationRecord;
  importMap: Map<string, string[]>;
  nestedMap: Map<string, string[]>;
};

const flatten = (
  computationRecord: ComputationRecord,
  searchable: SearchableProps,
  initialValues: Partial<FlatData> = {}
) => {
  const record: FlatComputationRecord = initialValues.record ?? {};
  let importMap = initialValues.importMap ?? new Map<string, string[]>();
  let nestedMap = initialValues.nestedMap ?? new Map<string, string[]>();

  Object.entries(computationRecord).map(([fieldId, computation]) => {
    if (fieldId in record) return;

    const flattenedComputation = flattenComputation(
      computation as NonNestedComputation,
      (type: string, name: string) => {
        return searchable[type]?.[name] ?? false;
      }
    );

    Object.entries(flattenedComputation).map(([id, value]) => {
      const computeId = addToImportMaps(id, value, fieldId);
      record[computeId] = value;
    });
  });

  function addToImportMaps(path: string, value: FlatComputation, base: string) {
    const segments = path.split(".");
    const current = segments[segments.length - 1] || base;

    const ids = getImportIds(value, computationRecord);
    importMap.set(current, ids);

    if (path === "") return current as FieldId;

    const parent = segments.length > 1 ? segments[segments.length - 2] : base;
    let array = nestedMap.get(parent);
    if (!array) {
      array = [];
      nestedMap.set(parent, array);
    }
    array.push(current);

    return current as FieldId;
  }

  return { record, importMap, nestedMap };
};

const getSortedValues = (
  id: DocumentId,
  {
    record,
    importMap,
    nestedMap,
  }: {
    record: FlatComputationRecord;
    importMap: Map<string, string[]>;
    nestedMap: Map<string, string[]>;
  }
) => {
  let computeWithDepth: (ComputationBlock & { depth: number })[] = [];
  let values: ValueRecord<TemplateFieldId> = {};

  const isPrimitive = (
    computation: FlatComputation
  ): computation is (string | boolean | number | Date)[] => {
    return computation.every(
      (el) =>
        ["string", "boolean", "number"].includes(typeof el) ||
        el instanceof Date
    );
  };

  const depthCache = new Map<string, number>();

  const getDepth = (id: string): number => {
    // 0 is result if field.imports === 0
    const cached = depthCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const importers: string[] = [];

    importMap.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    nestedMap.forEach((value, key) => {
      if (value.includes(id)) {
        importers.push(key);
      }
    });

    const result = Math.max(-1, ...importers.map(getDepth)) + 1;
    depthCache.set(id, result);
    return result;
  };

  Object.entries(record).map(([fieldId, value]) => {
    if (
      fieldId.indexOf("/") < 0 &&
      isPrimitive(value) &&
      getDocumentId(fieldId as FieldId) === id
    ) {
      values[getTemplateFieldId(fieldId as FieldId)] = value;
    } else {
      computeWithDepth.push({
        id: fieldId as FieldId,
        value,
        depth: getDepth(fieldId),
      });
    }
  });

  // SORT BY AND REMOVE DEPTH
  computeWithDepth.sort((a, b) => b.depth - a.depth);

  const compute = computeWithDepth.map(({ depth, ...el }) => el);

  return { values, compute };
};

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

const deduplicateWithMaxDepth = (
  input: (ComputationBlock & { depth: number })[]
) => {
  return input.reduce((acc, cur) => {
    const exists = acc.find((el) => el.id === cur.id);
    if (exists) {
      exists.depth = Math.max(exists.depth, cur.depth);
      return acc;
    }
    acc.push({ ...cur });
    return acc;
  }, [] as (ComputationBlock & { depth: number })[]);
};

const getFlatImportsWithDuplicates = (
  flatComputation: FlatComputation,
  record: FlatComputationRecord,
  parentDepth = 0
): (ComputationBlock & { depth: number })[] => {
  const blocks: ComputationBlock[] = Object.entries(record).map(
    ([id, value]) => ({ id: id as FieldId, value })
  );
  const flatArray = getChildrenFromFlatComputation(
    flatComputation,
    blocks,
    parentDepth
  );

  const imports = [{ value: flatComputation, depth: parentDepth }]
    .concat(flatArray)
    .reduce((acc, { value, depth }) => {
      getImportIds(value, record).forEach((id) => {
        const comp = record[id] ?? [];
        acc.push(
          { id, value: comp, depth: depth + 1 },
          ...getFlatImportsWithDuplicates(comp, record, depth + 1)
        );
      });

      return acc;
    }, [] as (ComputationBlock & { depth: number })[]);

  return [...flatArray, ...imports];
};
