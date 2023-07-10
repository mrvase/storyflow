import { RPCError, isError } from "@nanorpc/server";
import { custom, z } from "zod";
import type { DBDocumentRaw, DBValueRecord } from "../types";
import type {
  DBDocument,
  DocumentConfig,
  DocumentVersionRecord,
  SyntaxTree,
  SyntaxTreeRecord,
} from "@storyflow/cms/types";
import type {
  ColorToken,
  DateToken,
  DocumentId,
  FieldId,
  FileToken,
  FolderId,
  NestedDocumentId,
  RawFieldId,
  StoryflowConfig,
  ValueArray,
} from "@storyflow/shared/types";
import { client } from "../mongo";
import { globals } from "../globals";
import {
  USER_DOCUMENT_OFFSET,
  createDocumentId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  replaceDocumentId,
} from "@storyflow/cms/ids";
import { getSyntaxTreeRecord, getUrlParams, parseDocument } from "../convert";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { getPaths } from "../paths";
import { createObjectId } from "../mongo";
import { saveDocument, updateRecord } from "../fields/save";
import { createFetcher, findDocumentByUrl } from "../create-fetcher";
import { procedure } from "@storyflow/server/rpc";
import { copyRecord } from "@storyflow/cms/copy-record-async";
import { getSyntaxTreeEntries, isSyntaxTree } from "@storyflow/cms/syntax-tree";
import { tokens } from "@storyflow/cms/tokens";
import { calculate } from "@storyflow/cms/calculate-server";
import { Db } from "mongodb";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import {
  convertDataToDocument,
  convertDataToRecord,
  convertRecordToData,
  createRecordToDocumentMapFn,
  getCustomCollection,
  getCustomCollectionFromField,
  getCustomTemplateIds,
  getCustomTemplates,
} from "../collections/convert";
import { modifyKeys, modifyObject } from "../utils";
import { dataFromDb } from "../data";
import { createFieldRecordGetter } from "@storyflow/cms/get-field-record";
import util from "util";

export const createDocumentIdGenerator = (db: Db, batchSize: number) => {
  const ids: number[] = [];

  const fetchIds = async () => {
    const counter = await db
      .collection<{ name: string; counter: number }>("counters")
      .findOneAndUpdate({ name: "id" }, { $inc: { counter: batchSize } });
    const number = (counter.value ?? { counter: 0 }).counter;
    const first = number + USER_DOCUMENT_OFFSET + 1;
    ids.push(...Array.from({ length: batchSize - 1 }, (_, i) => first + 1 + i));
    return first;
  };

  async function generateDocumentId(): Promise<DocumentId>;
  async function generateDocumentId(
    documentId: DocumentId
  ): Promise<NestedDocumentId>;
  async function generateDocumentId(
    documentId?: DocumentId
  ): Promise<DocumentId | NestedDocumentId> {
    const number = ids.pop() ?? (await fetchIds());
    if (documentId) return createDocumentId(number, documentId);
    return createDocumentId(number);
  }

  return generateDocumentId;
};

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
      .query(async ({ folder, filters, limit, sort: sort_ }) => {
        let sort: Record<RawFieldId, 1 | -1> | undefined = undefined;

        if (sort_) {
          sort = Object.fromEntries(
            sort_.map((el): [string, 1 | -1] => [
              el.slice(1) as RawFieldId,
              el.slice(0, 1) === "+" ? 1 : -1,
            ])
          );
        }

        const customCollection = getCustomCollection(
          folder as FolderId,
          config
        );

        if (customCollection?.externalData) {
          const { fieldNames } = getCustomTemplateIds(customCollection.name);
          const namedFilters = filters
            ? modifyObject(filters, ([key, value]) => [
                fieldNames[key as RawFieldId],
                value[0],
              ])
            : {};

          const namedSort = sort
            ? modifyKeys(sort, (key) => fieldNames[key])
            : undefined;

          const data = await customCollection.externalData.readMany({
            sort: namedSort,
            filters: namedFilters,
            limit,
            offset: 0,
          });

          return data.map(createRecordToDocumentMapFn(customCollection));
        }

        /*
        const isCustom = parseInt(folder, 16) < 256 ** 2;
        if (isCustom) {
          const custom = getCustomCollection(folder as FolderId, config);
          const hook = custom?.hooks?.onReadMany;
          if (hook && custom.template) {
            const { fieldIds } = getCustomTemplateIds(custom.name);
            const fieldNames = modifyObject(fieldIds, ([key, value]) => [
              getRawFieldId(value),
              key,
            ]);

            const namedFilters = filters
              ? modifyObject(filters, ([key, value]) => [
                  fieldNames[key as RawFieldId],
                  value[0],
                ])
              : {};

            const namedSort = modifyKeys(sort, (key) => fieldNames[key]);

            const result = (
              await hook(
                { filters: namedFilters, limit, offset: 0, sort: namedSort },
                read
              )
            ).map(createRecordToDocumentMapFn(custom));

            console.log("RESULT", result);

            return result;
          }
        }
        */

        return await dataFromDb.readMany({
          folder: folder as FolderId,
          filters: filters as Record<FieldId, ValueArray>,
          limit,
          sort,
          offset: 0,
        });
      }),

    findTemplates: procedure.use(globals(config.api)).query(async () => {
      const documents = await createFetcher(dbName!)({
        folder: TEMPLATE_FOLDER,
      });

      documents.push(...getCustomTemplates(config));

      return documents;
    }),

    findByLabel: procedure
      .use(globals(config.api))
      .schema(z.string())
      .query(async (string) => {
        const db = await client.get(dbName);

        const filters = {
          [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.label.id)}`]: {
            $regex: string,
            $options: "i",
          },
        };

        const articles = (
          (await db
            .collection<DBDocumentRaw>("documents")
            .find(filters)
            .toArray()) ?? []
        ).map((el) => parseDocument(el));

        return articles;
      }),

    findById: procedure
      .use(globals(config.api))
      .schema(z.string())
      .query(async (id) => {
        const custom = getCustomTemplates(config).find((el) => el._id === id);

        if (custom) {
          return custom;
        }

        const customCollection = getCustomCollectionFromField(
          id as FieldId,
          config
        );

        if (customCollection?.externalData) {
          const data = await customCollection.externalData.readOne({
            id: id as DocumentId,
          });
          return {
            ...convertDataToDocument(data, customCollection),
            _id: id as DocumentId,
          };
        }

        return await dataFromDb.readOne({ id: id as DocumentId });
      }),

    update: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          id: z.string(),
          record: z.record(z.string(), z.any()),
          folder: z.string(),
          config: z.array(z.any()),
          versions: z.record(z.string(), z.any()),
        })
      )
      .mutate(async (input) => {
        const documentId = input.id as DocumentId;

        const customCollection = getCustomCollection(
          input.folder as FolderId,
          config
        );

        let record: SyntaxTreeRecord = {};
        let versions: DocumentVersionRecord = { config: [0] };
        let action: "update" | "create" = "create";

        if (customCollection?.externalData) {
          const data = await customCollection.externalData.readOne({
            id: documentId,
          });
          if (data) {
            record = convertDataToRecord(data, customCollection, documentId);
            action = "update";
          }
        } else {
          const doc = await dataFromDb.readOne({ id: documentId });
          if (doc) {
            record = doc.record;
            versions = doc.versions;
            action = "update";
          }
        }

        // update record
        const { record: newRecord, derivatives } = await updateRecord({
          documentId,
          oldRecord: record,
          newRecord: input.record,
        });

        // update versions
        const newVersions = Object.assign(versions, input.versions);

        if (customCollection?.externalData) {
          if (action === "update") {
            const data = await customCollection.externalData.update?.({
              id: documentId,
              data: convertRecordToData(newRecord, customCollection),
              doc: convertRecordToData(record, customCollection),
            });
            return {
              _id: documentId,
              folder: input.folder as FolderId,
              record: convertDataToRecord(data, customCollection, documentId),
              versions: newVersions,
              config: [],
            } satisfies DBDocument;
          } else {
            const data = await customCollection.externalData.create?.({
              id: documentId,
              data: convertRecordToData(newRecord, customCollection),
            });
            return {
              _id: documentId,
              folder: input.folder as FolderId,
              record: convertDataToRecord(data, customCollection, documentId),
              versions: newVersions,
              config: [],
            } satisfies DBDocument;
          }
        } else {
          if (action === "update") {
            return await dataFromDb.update({
              id: documentId,
              derivatives,
              record: newRecord,
              versions: newVersions,
              input,
            });
          } else {
            return await dataFromDb.create({
              id: documentId,
              derivatives,
              record: newRecord,
              versions: newVersions,
              input,
            });
          }
        }
      }),

    import: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          id: z.string(),
          folder: z.string(),
          config: z.array(z.any()),
          record: z.record(z.string(), z.any()),
          versions: z.record(z.string(), z.any()),
          rows: z.array(z.array(z.string())),
        })
      )
      .mutate(async (input) => {
        const db = await client.get(dbName);

        const documentId = input.id as DocumentId;

        // update record
        let { record, derivatives } = await updateRecord({
          documentId,
          oldRecord: {},
          newRecord: input.record,
        });

        // update versions
        const versions = Object.assign(
          { config: [0] } as DocumentVersionRecord,
          input.versions
        );

        const size = input.rows.length;
        const generateDocumentId = createDocumentIdGenerator(db, size);

        const sharedRecord = record;

        const result = await Promise.all(
          input.rows.map(async (row, index) => {
            const newDocumentId =
              index === 0 ? documentId : await generateDocumentId();

            /* COPY RECORD ER IKKE NOK! ÆNDRER IKKE ROOT KEYS */

            const modifyNode = (
              node: SyntaxTree
            ): SyntaxTree | boolean | FileToken | DateToken | ColorToken => {
              const newNode = {
                ...node,
                children: node.children.reduce(
                  (acc: typeof node.children, child) => {
                    if (isSyntaxTree(child)) {
                      acc.push(modifyNode(child));
                      return acc;
                    }
                    if (
                      !tokens.isContextToken(child) ||
                      !child.ctx.startsWith("import:")
                    ) {
                      acc.push(child);
                      return acc;
                    }

                    const index = parseInt(child.ctx.split(":")[1], 10);
                    const value = row[index];

                    if (typeof value === "string" && value !== "") {
                      if (`${Number(value)}` === value) {
                        acc.push(Number(value));
                      } else {
                        acc.push(value);
                      }
                    }

                    return acc;
                  },
                  []
                ),
              };

              if (
                ["to_boolean", "to_file", "to_date", "to_color"].includes(
                  node.type as string
                )
              ) {
                const result = calculate(newNode, () => undefined);
                if (!Array.isArray(result)) return newNode;
                return result[0] as
                  | boolean
                  | FileToken
                  | DateToken
                  | ColorToken;
              }

              return newNode;
            };

            let record = Object.fromEntries(
              getSyntaxTreeEntries(sharedRecord).map(([key, value]) => {
                if (getDocumentId(key) === documentId) {
                  return [
                    replaceDocumentId(key, newDocumentId),
                    modifyNode(value) as SyntaxTree,
                  ];
                }
                return [key, modifyNode(value) as SyntaxTree];
              })
            );

            if (index !== 0) {
              record = await copyRecord(record, {
                generateNestedDocumentId: () =>
                  generateDocumentId(newDocumentId),
                generateTemplateFieldId: (key: FieldId) =>
                  replaceDocumentId(key, newDocumentId),
                oldDocumentId: documentId,
                newDocumentId,
              });
            }

            return saveDocument({
              record,
              derivatives,
              versions,
              documentId: newDocumentId,
              input,
            });
          })
        );

        if (result.some((el) => el instanceof RPCError)) {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Failed to update",
          });
        }

        return result as DBDocument[];
      }),

    deleteMany: procedure
      .use(globals(config.api))
      .schema(z.array(z.string()))
      .mutate(async (ids) => {
        return await dataFromDb.deleteMany({ ids: ids as DocumentId[] });
      }),

    getPaths: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          namespace: z.string(),
        })
      )
      .query(async ({ namespace }) => {
        const db = await client.get(dbName);

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

        return await getPaths(docs, createFetcher(dbName));
      }),

    getUpdatedPaths: procedure
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

        const paths = await getPaths(docsFiltered); // createFetcher(dbName!)

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

    submit: procedure
      .schema(
        z.object({
          id: z.string(),
          action: z.string(),
          data: z.record(z.array(z.string())),
          url: z.string(),
          namespaces: z.array(z.string()).optional(),
        })
      )
      .mutate(async ({ action, id, namespaces, url, data }) => {
        console.log("IS SUBMITTING", action, url, data);
        const doc = await findDocumentByUrl({
          url,
          namespaces,
          dbName,
        });

        if (!doc) {
          return new RPCError({
            code: "NOT_FOUND",
            status: 404,
            message: "No server action found [1]",
          });
        }

        const params = getUrlParams(url);

        const getFieldRecord = createFieldRecordGetter(
          doc.record,
          { ...params, ...data },
          createFetcher(dbName),
          {
            createActions: true,
          }
        );

        const pageRecord = await getFieldRecord(
          createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)
        );

        if (!pageRecord) {
          return new RPCError({
            code: "NOT_FOUND",
            status: 404,
            message: "No server action found [2]",
          });
        }

        const db = await client.get(dbName);

        const actionValue = pageRecord.record[action as FieldId];

        if (!action || !Array.isArray(actionValue) || action.length === 0) {
          return new RPCError({
            code: "NOT_FOUND",
            status: 404,
            message: "No server action found [3]",
          });
        }

        const inserts = (actionValue as any[]).filter(
          (
            el
          ): el is {
            values: DBValueRecord;
            action: "insert";
            folder: FolderId;
          } => typeof el === "object" && el !== null && el.action === "insert"
        );

        if (!inserts.length) {
          return new RPCError({
            code: "NOT_FOUND",
            status: 404,
            message: "No server action found [4]",
          });
        }

        const generateDocumentId = createDocumentIdGenerator(
          db,
          inserts.length
        );

        await Promise.all(
          inserts.map(async ({ folder, values }): Promise<DBDocument> => {
            const documentId = await generateDocumentId();

            const customCollection = getCustomCollection(folder, config);

            const record = getSyntaxTreeRecord(documentId, {
              values,
              fields: [],
            });

            console.log(
              "RECORD",
              util.inspect({ record }, { depth: null, colors: true })
            );

            const versions: DocumentVersionRecord = { config: [0] };

            if (customCollection?.externalData) {
              const data = await customCollection.externalData.create?.({
                id: documentId,
                data: convertRecordToData(record, customCollection),
              });
              return {
                _id: documentId,
                folder,
                record: convertDataToRecord(data, customCollection, documentId),
                versions,
                config: [],
              } satisfies DBDocument;
            } else {
              const result = await dataFromDb.create({
                id: documentId,
                derivatives: [],
                record,
                versions,
                input: {
                  folder,
                  versions: {},
                  config: [],
                },
                isCreatedFromValues: true,
              });

              return result;
            }
          })
        );
        return null;
      }),
  };
};
