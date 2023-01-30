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
} from "@storyflow/backend/types";
import { ModifyResult, ObjectId, WithId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { Redis } from "@upstash/redis";
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
import { createComputationTransformer, fieldConfig } from "shared/fieldConfig";
import { modifyNestedChild } from "@storyflow/backend/traverse";
import { inputConfig } from "shared/inputConfig";
import {
  flattenComputation,
  getChildrenFromFlatComputation,
  getComputationRecord,
  getFlatComputationRecord,
  restoreComputation,
} from "@storyflow/backend/flatten";
import {
  getDocumentId,
  getTemplateFieldId,
  isTemplateField,
} from "@storyflow/backend/ids";
import { createStages, Update } from "../aggregation/stages";
import util from "util";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";

export const removeObjectId = <T extends { _id: any }>({
  _id,
  ...rest
}: T): Omit<T, "_id"> => rest;

const client = new Redis({
  url: "https://eu1-renewed-albacore-38555.upstash.io",
  token:
    "AZabASQgMTJiNTQ4YjQtN2Q1ZS00YWUwLWE4MDAtNmQ4MDM5NDdhMTBkYmFkZDBkOTI4ZWRhNGIzYWE0OGNmMjVhMGY4YmE3YzQ=",
});

const modifyValues = <T extends { [key: string]: any }, U>(
  obj: T,
  callback: (value: T[keyof T]) => U
) => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, callback(value)])
  );
};

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

const getHistoriesFromIds = async (slug: string, keys: string[]) => {
  if (keys.length === 0) return {};

  let getPipeline = client.pipeline();

  keys.forEach((key) => {
    getPipeline.lrange(`${slug}:${key}`, 0, -1);
  });

  const result = await getPipeline.exec();

  const object = Object.fromEntries(
    result.map((value, index) => [
      `${keys[index]}`,
      (value ?? []) as ServerPackage<any>[],
    ])
  );

  return object;
};

const resetHistory = async (slug: string, id: string) => {
  const pipeline = client.pipeline();
  try {
    pipeline.del(`${slug}:${id}`);
    // pipeline.lpush(id, JSON.stringify(VERSION));
    return await pipeline.exec();
  } catch (err) {
    console.log(err);
  }
};

const sortHistories = (
  array: ServerPackage<any>[]
): Record<string, ServerPackage<any>[]> => {
  return array.reduce((acc: Record<string, ServerPackage<any>[]>, cur) => {
    if (!acc[cur[0]]) {
      acc[cur[0]] = [];
    }
    const a = acc[cur[0]];
    a.push(cur as never);
    return acc;
  }, {});
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

const ZodFieldRef = z.lazy(() =>
  z.object({ id: z.string(), label: z.string(), type: z.string().optional() })
);

const ZodTemplateItem = z.lazy(() =>
  z.union([
    z.object({ template: z.string() }),
    z.object({ text: z.string(), level: z.number() }),
    ZodFieldRef,
    z.array(ZodFieldRef),
  ])
);

export const ZodServerPackage = <T extends z.ZodType>(Operation: T) =>
  z.tuple([
    z.string(), // key
    z.union([z.string(), z.number()]).nullable(), // clientId
    z.number(), // previous
    z.array(Operation),
  ]);

export const ZodDocumentOp = <T extends z.ZodType>(Action: T) =>
  z.object({
    target: z.string(),
    mode: z.string().optional(),
    ops: z.array(Action),
  });

export const ZodSplice = <T extends z.ZodType>(Action: T) =>
  z.object({
    index: z.number(),
    remove: z.number().optional(),
    insert: z.array(Action).optional(),
  });

export const ZodToggle = <T extends z.ZodType>(Value: T) =>
  z.object({
    name: z.string(),
    value: Value,
  });

export const articles = createRoute({
  fields: createProcedure({
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
        (await db.collection("articles").find({ folder }).toArray()) ?? []
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
          .collection("articles")
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
        .collection("articles")
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
        .collection("articles")
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
        .collection("articles")
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
                label: z.string(),
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
        let flatData = flatten(record);

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

        flatData = flatten(importsRecord, flatData);

        return getSortedValues(id as DocumentId, flatData);
      };

      const batchQuery = (() => {
        const collectedIds = new Set<string>();
        const resolvers = new Set<(value: DBDocument[]) => void>();

        const fetch = async () => {
          console.log("IDS", Array.from(collectedIds));
          const array = await db
            .collection("articles")
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
          { $merge: "articles" },
        ])
        .next()
        .then(() => ({ acknowledged: true }))
      */

      const result: { acknowledged: boolean }[] = await Promise.all([
        ...(inserts.length
          ? inserts.map((insert) =>
              db.collection("articles").updateOne(
                { id: insert.id },
                [
                  {
                    $set: {
                      id: insert.id,
                      folder: insert.folder,
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
          ? [db.collection("articles").deleteMany({ id: { $in: removes } })]
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

      // let shortId = input.shortId ?? (await getShortIds("articles", 1, db))[0];

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

      const result = await db.collection("articles").insertMany(articles);

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
        .collection("articles")
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
      return z.string();
    },
    async mutation(id, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const [article, histories] = await Promise.all([
        db.collection("articles").findOne({ id }) as Promise<
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

      let flatData = flatten(computationRecord);

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

      const getDrefs = (fieldId: FieldId, record: FlatComputationRecord) => {
        const comp = record[fieldId];
        if (!comp) return [];
        return comp.reduce((refs, el, index) => {
          if (el !== null && typeof el === "object" && "dref" in el) {
            refs.push(el.dref);
          } else if (index > 0 && Array.isArray(el) && el[0] === "p") {
            // if updated field has pick, we may need to include derivative again
            const former = comp[index - 1];
            if (
              former !== null &&
              typeof former === "object" &&
              "fref" in former
            ) {
              // may not yet be available
              refs.push(...getDrefs(former.fref, record));
            }
          }
          return refs;
        }, [] as DocumentId[]);
      };

      const drefs: DocumentId[] = [];

      updatedFieldsIds.forEach((fieldId) => {
        drefs.push(...getDrefs(fieldId, flatData.record));
      });

      drefs.forEach((ref) => {
        if (!externalDocumentIds.includes(ref)) {
          externalDocumentIds.push(ref);
        }
      });

      const importedArticles = await db
        .collection("articles")
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

      flatData = flatten(importsRecord, flatData);

      const newDrefs: DocumentId[] = [];

      updatedFieldsIds.forEach((fieldId) => {
        // some imported values may now have become available
        getDrefs(fieldId, flatData.record).forEach((id) => {
          if (!drefs.includes(id)) {
            newDrefs.push(id);
          }
        });
      });

      if (newDrefs.length) {
        throw new Error("Need to implement second order query on drefs");
      }

      const drefArticles = importedArticles.filter((doc) =>
        drefs.includes(doc.id)
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
        util.inspect(derivatives, { depth: null, colors: true })
      );

      const cached: FieldId[] = [];
      updatedFieldsIds.forEach((id) => {
        if (!(id in values) && !isTemplateField(id)) {
          cached.push(id);
        }
      });

      const result1 = (await db.collection("articles").findOneAndUpdate(
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
        const compute = doc.compute;
        const values = doc.values;
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
            result: values[getTemplateFieldId(id)] ?? cachedRecord[id] ?? [],
            _imports,
            imports: [], // should just be empty
          };
        });

        console.log(
          "UPDATES",
          util.inspect(updates, { depth: null, colors: true })
        );

        /*
        I could first find the articles and in the update stage use the article ids
        then I could send urls back to the client for revalidation.
        */

        await db.collection("articles").updateMany(
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
      return z.object({ domain: z.string(), revalidateUrl: z.string() });
    },
    async query({ domain, revalidateUrl }, { dbName }) {
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
        .collection("articles")
        .find({
          [`values.${URL_ID}`]: { $exists: true },
        })
        .toArray();

      const urls = articles.map((el) => el.values[URL_ID][0] as string);

      console.log(urls, revalidateUrl);

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
      const fields = getComputationRecord(article);
      const value = fields[id];
      if (value) {
        const addImports = (id: FieldId, value: Computation) => {
          record[id] = value;
          const imports = inputConfig.getImportIds(value);
          imports.forEach((importId) => {
            if (importId in record) return;
            if (importId.startsWith(article.id)) {
              addImports(importId, fields[importId]);
            } else {
              const block = article.compute.find((el) => el.id === importId)!;
              // elements used for restoration are all in imports
              const value = restoreComputation(block.value, article.compute);
              addImports(importId, value);
            }
          });
        };

        addImports(id, value);
        return;
      }
    }

    record[id] = [];
  });

  return record;
};

const flatten = (
  computationRecord: ComputationRecord,
  initialValues: {
    record?: FlatComputationRecord;
    importMap?: Map<string, string[]>;
    nestedMap?: Map<string, string[]>;
  } = {}
) => {
  const record: FlatComputationRecord = initialValues.record ?? {};
  let importMap = initialValues.importMap ?? new Map<string, string[]>();
  let nestedMap = initialValues.nestedMap ?? new Map<string, string[]>();

  Object.entries(computationRecord).map(([fieldId, computation]) => {
    if (fieldId in record) return;

    const flattenedComputation = flattenComputation(computation);

    Object.entries(flattenedComputation).map(([id, value]) => {
      const computeId = addToImportMaps(id, value, fieldId);
      record[computeId] = value;
    });
  });

  function addToImportMaps(path: string, value: FlatComputation, base: string) {
    const segments = path.split(".");
    const current = segments[segments.length - 1] || base;

    const ids = inputConfig.getImportIds(value);
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
      return fieldConfig[type].initialValue;
    }
    return null;
  };

  const defaultValue = initialValue ?? getData(type);

  if (defaultValue === null) {
    return initialValue ?? [];
  }

  const transformer = createComputationTransformer(defaultValue);

  let value = defaultValue;

  let transform = fieldConfig[type].transform;

  transformer(pkgs).forEach((pkg) => {
    unwrapServerPackage(pkg).operations.forEach((operation) => {
      const { input, location } = targetTools.parse(operation.target);
      if (location === "") {
        value = decodeEditorComputation(
          inputConfig.getNextState(
            encodeEditorComputation(value, transform) as Computation,
            operation
          ) as EditorComputation,
          transform
        );
      } else {
        const path = targetTools.getLocation(operation.target);
        const result = modifyNestedChild(value, path.split("."), (value) => {
          return decodeEditorComputation(
            inputConfig.getNextState(
              encodeEditorComputation(value) as Computation,
              operation
            ) as EditorComputation
          );
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
        const fieldId = targetTools.getLocation(operation.target);
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
      inputConfig.getImportIds(value).forEach((id) => {
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
