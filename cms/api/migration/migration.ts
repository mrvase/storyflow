import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import clientPromise from "../mongo/mongoClient";
import { z } from "zod";
import {
  DBDocumentRaw,
  DBSyntaxStreamBlock,
  FunctionName,
  RawFieldId,
} from "@storyflow/backend/types";
import { WithId } from "mongodb";

const transformField = (field: DBSyntaxStreamBlock): DBSyntaxStreamBlock => {
  return {
    k: field.k,
    v: field.v.map((token) => {
      if (token !== null && typeof token === "object") {
        if (")" in token && typeof token[")"] === "string") {
          const f = token[")"] as FunctionName | "sortlimit";
          if (f === "sortlimit" || f === "fetch") {
            return { fetch: [(token as any).l] as [number] };
          }
          if (f === "select") {
            return { select: (token as any).s } as { select: RawFieldId };
          }
          return { [f]: true } as { [key in FunctionName]: any };
        }
        if ("{" in token) {
          return { "(": true } as { "(": true };
        }
        if ("}" in token) {
          return { merge: true } as { merge: true };
        }
        return token;
      }
      return token;
    }),
  };
};

const transform = (
  doc: WithId<Omit<DBDocumentRaw, "_id">>
): WithId<Omit<DBDocumentRaw, "_id">> => {
  const fields = doc.fields.map(transformField);

  return {
    ...doc,
    values: {
      ...doc.values,
      ...("000005000000" in doc.values
        ? { "000005000000": [`/${doc.values["000005000000"]}`] }
        : {}),
    },
    fields,
  };
};

export const migration = createRoute({
  migrate: createProcedure({
    async query() {
      if (process.env.NODE_ENV === "development") {
        const db1 = (await clientPromise).db("kfs2-hyz7");
        const db2 = (await clientPromise).db(
          `kfs-${Math.random().toString(36).slice(2, 6)}`
        );

        const docs = await db1
          .collection<Omit<DBDocumentRaw, "_id">>("documents")
          .find()
          .toArray();

        await db2.collection("documents").insertMany(docs.map(transform));

        return success({
          headers: {},
        });
      } else {
        return error({
          message: "This function can only be run in development.",
        });
      }
    },
  }),
});
