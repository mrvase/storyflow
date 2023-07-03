import { RPCError, isError } from "@nanorpc/server";
import { z } from "zod";
import type { DBDocumentRaw } from "../types";
import type { DBDocument, SyntaxTree } from "@storyflow/cms/types";
import type {
  ColorToken,
  DateToken,
  DocumentId,
  FieldId,
  FileToken,
  FolderId,
  NestedDocumentId,
  StoryflowConfig,
  ValueArray,
} from "@storyflow/shared/types";
import { client } from "../mongo";
import { globals } from "../globals";
import {
  USER_DOCUMENT_OFFSET,
  createDocumentId,
  createRawTemplateFieldId,
  getDocumentId,
  replaceDocumentId,
} from "@storyflow/cms/ids";
import { parseDocument } from "../convert";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { getPaths } from "../paths";
import { createObjectId } from "../mongo";
import { saveResult, updateRecord } from "../fields/save";
import { createFetcher } from "../create-fetcher";
import { procedure } from "@storyflow/server/rpc";
import { copyRecord } from "@storyflow/cms/copy-record-async";
import { getSyntaxTreeEntries, isSyntaxTree } from "@storyflow/cms/syntax-tree";
import { tokens } from "@storyflow/cms/tokens";
import { calculate } from "@storyflow/cms/calculate-server";
import { Db } from "mongodb";

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
        const documentId = input.id as DocumentId;

        const db = await client.get(dbName);

        const doc: Pick<
          DBDocumentRaw,
          "_id" | "fields" | "values" | "versions"
        > = (await db
          .collection<DBDocumentRaw>("documents")
          .findOne({ _id: createObjectId(documentId) })) ?? {
          _id: createObjectId(documentId),
          fields: [],
          values: {},
          versions: { config: [0] },
        };

        // update record
        const { record, derivatives } = await updateRecord({
          documentId,
          doc,
          input,
        });

        // update versions
        const versions = Object.assign(doc.versions, input.versions);

        return await saveResult({
          record,
          derivatives,
          versions,
          documentId,
          input,
        });
      }),

    updateMany: procedure
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

        const doc: Pick<
          DBDocumentRaw,
          "_id" | "fields" | "values" | "versions"
        > = {
          _id: createObjectId(documentId),
          fields: [],
          values: {},
          versions: { config: [0] },
        };

        // update record
        let { record, derivatives } = await updateRecord({
          documentId,
          doc,
          input,
        });

        // update versions
        const versions = Object.assign(doc.versions, input.versions);

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

              /*
              const child = newNode.children[0];
              
              if (node.type === "to_boolean") {
                return child === "true";
              }
              if (node.type === "to_file") {
                const src = typeof child === "string" ? child : "";
                return { src };
              }
              if (node.type === "to_date") {
                const dateString = typeof child === "string" ? child : "";
                const date = new Date(dateString);
                const validDate =
                  date.toString() !== "Invalid Date" ? date : new Date();
                return { date: validDate.toISOString() };
              }
              if (node.type === "to_color") {
                const color =
                  typeof child === "string" && child.match(/^#[A-Fa-f0-9]{6}$/)
                    ? child
                    : "#ffffff";
                return { color };
              }
              */

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

            return saveResult({
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
  };
};
