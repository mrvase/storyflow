import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { clientPromise } from "../mongo/mongoClient";
import type { FunctionName, RawFieldId } from "@storyflow/shared/types";
import type {
  DBDocumentRaw,
  DBSyntaxStreamBlock,
  DocumentConfigItem,
} from "@storyflow/db-core/types";
import { getRawFieldId } from "@storyflow/fields-core/ids";
import { unwrapObjectId } from "@storyflow/db-core/convert";

const transformField = (field: DBSyntaxStreamBlock): DBSyntaxStreamBlock => {
  const value = field.v.map((token) => {
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
  });

  if (getRawFieldId(unwrapObjectId(field.k)) === "000005000000") {
    value.splice(3, 0, "/");
  }

  return {
    k: field.k,
    v: value,
  };
};

const transformConfig = (field: DocumentConfigItem) => {
  if ("id" in field) {
    if ("type" in field && (field.type as any) === "default") {
      delete field.type;
    }
    if ("transform" in field) {
      delete field.transform;
    }
  }
  return field;
};

const transform = (doc: DBDocumentRaw): DBDocumentRaw => {
  const fields = doc.fields.map(transformField);
  const config = doc.config.map(transformConfig);

  return {
    ...doc,
    values: {
      ...doc.values,
      ...("000005000000" in doc.values
        ? { "000005000000": [`/${doc.values["000005000000"]}`] }
        : {}),
    },
    fields,
    config,
  };
};

const copyCollection = async <T extends object = any>(
  collection: string,
  options: {
    fromDb: string;
    toDb: string;
    transform: (doc: T) => T;
  }
) => {
  const db1 = (await clientPromise).db(options.fromDb);
  const db2 = (await clientPromise).db(options.toDb);

  let docs = (await db1.collection(collection).find().toArray()) as T[];

  if (options.transform) {
    docs = docs.map((doc) => options.transform(doc as T));
  }

  await db2.collection(collection).deleteMany({});
  await db2.collection(collection).insertMany(docs);

  console.log("MIGRATED DOCUMENTS:", docs.length);
};

export const migration = createRoute({
  migrate: createProcedure({
    async query() {
      if (process.env.NODE_ENV === "development") {
        /*
        copyCollection("documents", { fromDb: "kfs2-hyz7", toDb: "kfs-hyz7", transform });
        */

        /*
        const result = (await client.lrange(
          `kfs2:folders`,
          0,
          -1
        )) as ServerPackage<any>[];

        const array = result.map((el): ServerPackage<any> => {
          return [
            el[0],
            el[1],
            el[2],
            el[3].map((el) => {
              return [el.target.split(":").slice(-1)[0], el.ops];
            }),
          ];
        });

        const pipeline = client.pipeline();
        pipeline.del("kfs:folders");
        pipeline.rpush(`kfs:folders`, ...array.map((el) => JSON.stringify(el)));
        await (pipeline as any).exec();
        */

        return success("true");
      } else {
        return error({
          message: "This function can only be run in development.",
        });
      }
    },
  }),
});
