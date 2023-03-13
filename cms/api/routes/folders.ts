import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success, unwrap } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DBDocumentRaw,
  DBFolder,
  DBFolderRaw,
  DocumentId,
  RawDocumentId,
} from "@storyflow/backend/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { computeFieldId, FIELDS } from "@storyflow/backend";
import {
  ZodDocumentOp,
  ZodServerPackage,
  ZodSplice,
  ZodToggle,
} from "../collab-utils/zod";
import {
  client,
  getHistoriesFromIds,
  modifyValues,
  sortHistories,
} from "../collab-utils/redis-client";
import { ServerPackage } from "@storyflow/state";
import { unwrapObjectId } from "@storyflow/backend/ids";

export const removeObjectId = <T extends { _id: any }>({
  _id,
  ...rest
}: T): Omit<T, "_id"> => rest;

const parseFolder = (raw: DBFolderRaw): DBFolder => {
  const { _id, template, ...rest } = raw;
  return {
    _id: unwrapObjectId(raw._id),
    ...(template && { template: unwrapObjectId(template) }),
    ...rest,
  };
};

export const folders = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName, slug }) {
      const db = (await clientPromise).db(dbName);

      const folders = await db
        .collection<DBFolderRaw>("folders")
        .find({})
        .toArray();

      const array: DBFolder[] = folders.map((el) => parseFolder(el));

      const histories = sortHistories(
        (await client.lrange(`${slug}:folders`, 0, -1)) as ServerPackage<any>[]
      );

      return success({ folders: array, histories });
    },
  }),

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
              ZodDocumentOp(
                z.object({
                  id: z.string(),
                  type: z.string(),
                  children: z.any(),
                  label: z.string(),
                })
              ),
              ZodDocumentOp(z.string()),
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

  /*
  update: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.array(
        z.object({
          id: z.string(),
          actions: z.array(
            z.union([
              z.object({
                type: z.literal("reorder"),
                children: z.array(
                  z.union([
                    z.object({
                      id: z.string(),
                      index: z.string(),
                      after: z.string().nullable(),
                    }),
                    z.object({ remove: z.string() }),
                  ])
                ),
                insert: z
                  .object({
                    id: z.string(),
                    label: z.string(),
                    type: z.union([z.literal("data"), z.literal("app")]),
                    frontId: z.string().optional(),
                  })
                  .optional(),
              }),
              z.object({
                name: z.string(),
                value: z.string(),
              }),
              z.object({
                name: z.string(),
                value: z.array(z.string()),
              }),
            ])
          ),
        })
      );
    },
    async mutation(input, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const updates = new Map<
        string,
        {
          id: string;
          label?: string;
          template?: string;
          children?: FolderChild[];
          domains?: string[];
        }
      >();

      const inserts = new Map<string, DBFolder>();

      const setProp = (key: string, name: string, value: any) => {
        const insert = inserts.get(key);
        if (insert) {
          inserts.set(key, { ...insert, [name]: value });
          return;
        }
        const update = updates.get(key);
        if (update) {
          updates.set(key, { ...update, [name]: value });
        } else {
          updates.set(key, { id: key, [name]: value });
        }
      };

      const setChildren = (key: string, children: FolderChild[]) => {
        const insert = inserts.get(key);
        if (insert) {
          inserts.set(key, {
            ...insert,
            children: [...insert.children, ...children],
          });
          return;
        }
        const update = updates.get(key);
        if (update) {
          updates.set(key, {
            ...update,
            children: [...(update.children ?? []), ...children],
          });
        } else {
          updates.set(key, { id: key, children });
        }
      };

      input.forEach((operation) => {
        operation.actions.forEach((action) => {
          if ("name" in action) {
            setProp(operation.id, action.name, action.value);
          } else if (action.type === "reorder") {
            setChildren(operation.id, action.children);
            if (action.insert) {
              inserts.set(operation.id, {
                ...action.insert,
                children: [],
              });
            }
          }
        });
      });

      const updatePromises = Array.from(updates.values()).map(
        ({ id, label, template, domains, children }) => {
          return db
            .collection<DBFolder>("folders")
            .findOneAndUpdate(
              { id },
              {
                ...((label !== undefined ||
                  template !== undefined ||
                  domains !== undefined) && {
                  $set: {
                    ...(label !== undefined && { label }),
                    ...(template !== undefined && {
                      template: template as DocumentId,
                    }),
                    ...(domains !== undefined && {
                      domains,
                    }),
                  },
                }),
                ...(children !== undefined && {
                  $push: {
                    children: { $each: children },
                  },
                }),
              },
              {
                returnDocument: "after",
              }
            )
            .then((result) => {
              return result.value
                ? (removeObjectId(result.value) as DBFolder)
                : null;
            });
        }
      );

      if (inserts.size === 0) {
        return success(
          (await Promise.all(updatePromises)).filter(
            (el): el is Exclude<typeof el, null> => el !== null
          )
        );
      }

      const insertFolders = Array.from(inserts.values());

      const insertDocuments = insertFolders
        .filter(
          (el): el is typeof el & { frontId: DocumentId } =>
            "frontId" in el && typeof el.frontId === "string"
        )
        .map((el) => {
          const article: DBDocumentRaw = {
            _id: new ObjectId(el.frontId),
            folder: new ObjectId(el._id),
            versions: {},
            config: [],
            compute: [
              {
                id: computeFieldId(el.frontId, FIELDS.url.id),
                value: [{ "(": true }, "", "", { ")": "url" }],
              },
              {
                id: computeFieldId(el.frontId, FIELDS.label.id),
                value: ["Forside"],
              },
            ],
            values: {
              [FIELDS.url.id]: [""],
              [FIELDS.label.id]: ["Forside"],
            },
          };
          return article;
        });

      const insertFoldersPromise = db
        .collection<DBFolder>("folders")
        .insertMany(insertFolders);

      const insertDocumentsPromise =
        insertDocuments.length === 0
          ? { acknowledged: true }
          : db.collection<DBDocument>("documents").insertMany(insertDocuments);

      const [insertFoldersResult, insertDocumentsResult, ...updateResults] =
        await Promise.all([
          insertFoldersPromise,
          insertDocumentsPromise,
          ...updatePromises,
        ]);

      if (
        !insertFoldersResult.acknowledged ||
        !insertDocumentsResult.acknowledged
      ) {
        throw new Error("Fejlede");
      }

      const array: DBFolder[] = [
        ...updateResults.filter(
          (el): el is Exclude<typeof el, null> => el !== null
        ),
        ...insertFolders,
      ];

      return success(array);
    },
  }),
  */
});
