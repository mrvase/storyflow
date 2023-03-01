import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import {
  DBDocument,
  DBFolder,
  DocumentId,
  FolderChild,
} from "@storyflow/backend/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { LABEL_ID, URL_ID } from "@storyflow/backend/templates";
import { computeFieldId } from "@storyflow/backend";

export const removeObjectId = <T extends { _id: any }>({
  _id,
  ...rest
}: T): Omit<T, "_id"> => rest;

const modifyValues = <T extends Record<string, any>>(
  obj: T,
  callback: (val: any) => any
): T =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, callback(value)])
  ) as T;

export const folders = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { dbName }) {
      const db = (await clientPromise).db(dbName);

      const folders = await db
        .collection("folders")
        .find<DBFolder & { _id: ObjectId }>({})
        .toArray();

      const array: DBFolder[] = folders.map(removeObjectId);

      return success(array);
    },
  }),

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
          const article: DBDocument = {
            id: el.frontId,
            folder: el.id,
            versions: {},
            config: [],
            compute: [
              {
                id: computeFieldId(el.frontId, URL_ID),
                value: [{ "(": true }, "", "", { ")": "url" }],
              },
              {
                id: computeFieldId(el.frontId, LABEL_ID),
                value: ["Forside"],
              },
            ],
            values: {
              [URL_ID]: [""],
              [LABEL_ID]: ["Forside"],
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
});
