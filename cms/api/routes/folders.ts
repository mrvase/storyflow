import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import { DBFolder, DocumentId, FolderChild } from "@storyflow/core/types";
import { ObjectId } from "mongodb";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";

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
                  })
                  .optional(),
              }),
              z.object({
                name: z.string(),
                value: z.string(),
              }),
            ])
          ),
        })
      );
    },
    async mutation(input, { dbName }) {
      const db = (await clientPromise).db(dbName);
      console.log("FOLDER UPDATE", input);

      const updates = new Map<
        string,
        {
          id: string;
          label?: string;
          template?: string;
          children?: FolderChild[];
        }
      >();
      const inserts = new Map<string, DBFolder>();

      const setProp = (key: string, name: string, value: string) => {
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
        ({ id, label, template, children }) => {
          return db
            .collection<DBFolder>("folders")
            .findOneAndUpdate(
              { id },
              {
                ...((label !== undefined || template !== undefined) && {
                  $set: {
                    ...(label !== undefined && { label }),
                    ...(template !== undefined && {
                      template: template as DocumentId,
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

      const insertValues = Array.from(inserts.values());

      const insertPromise = db
        .collection<DBFolder>("folders")
        .insertMany(insertValues);

      const [insertResult, ...updateResults] = await Promise.all([
        insertPromise,
        ...updatePromises,
      ]);

      if (!insertResult.acknowledged) {
        throw new Error("Fejlede");
      }

      const array: DBFolder[] = [
        ...updateResults.filter(
          (el): el is Exclude<typeof el, null> => el !== null
        ),
        ...insertValues,
      ];

      return success(array);
    },
  }),
});
