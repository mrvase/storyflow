import { getClientPromise, setClientPromise } from "../mongoClient";
import { Redis } from "@upstash/redis";
import { RPCError, createProcedure } from "@nanorpc/server";

const copyCollection = async <T extends object = any>(options: {
  collection: string;
  fromDb: string;
  toDb: string;
  transform?: (doc: T) => T;
}) => {
  const db1 = (await getClientPromise()).db(options.fromDb);
  const db2 = (await getClientPromise()).db(options.toDb);

  let docs = (await db1.collection(options.collection).find().toArray()) as T[];

  if (options.transform) {
    docs = docs.map((doc) => options.transform!(doc as T));
  }

  await db2.collection(options.collection).deleteMany({});
  await db2.collection(options.collection).insertMany(docs);

  return docs.length;
};

export const client = new Redis({
  url: "https://eu1-renewed-albacore-38555.upstash.io",
  token: process.env.UPSTASH_TOKEN as string,
});

export const migration = {
  migrate: createProcedure().query(async () => {
    setClientPromise(process.env.MONGO_URL!);
    if (process.env.NODE_ENV === "development") {
      /*
        await copyCollection({
          collection: "documents",
          fromDb: "kfs-hyz7",
          toDb: "kfs-abcd",
          transform(el) {
            if ("versions" in el) {
              el.versions = Object.fromEntries(
                Object.entries(el.versions).map(([key, value]) => [
                  key,
                  typeof value === "number" ? [value] : value,
                ])
              );
            }
            if ("label" in el) {
              el.values["00000e000000"] = [el.label];
              delete el.label;
            }
            return el;
          },
        });

        await copyCollection({
          collection: "counters",
          fromDb: "kfs-hyz7",
          toDb: "kfs-abcd",
        });

        await copyCollection({
          collection: "files",
          fromDb: "kfs-hyz7",
          toDb: "kfs-abcd",
        });
        */
      type Package = [
        queue: string,
        user: string,
        index: number,
        transactions: [target: string, ops: Operation[]][]
      ];

      type Operation =
        | { add: any }
        | { _id: any; label: string }
        | { index: number; insert: any }
        | { index: number; remove: number }
        | { name: "domains"; value: string[] }
        | { name: "termplate"; value: string };

      const result = (await client.lrange(
        `kfs_backup:folders`,
        0,
        -1
      )) as Package[];

      let failed: any[] = [];

      const transactions = result
        .map((el) => {
          const queue = el[0];
          return el[3]
            .map((el) => {
              return el[1];
            })
            .flat(1)
            .map((el) => {
              if ("add" in el) {
                return [el.add._id, [["label", el.add.label]]];
              }
              if ("_id" in el) {
                return [el._id, [["label", el.label]]];
              }
              if ("insert" in el) {
                return [queue.replace("/", ":"), [[el.index, 0, el.insert]]];
              }
              if ("remove" in el) {
                return [queue.replace("/", ":"), [[el.index, el.remove]]];
              }
              if ("name" in el) {
                return [queue.replace("/", ":"), [[el.name, el.value]]];
              }
              failed.push(el);
            });
        })
        .flat(1);

      client.del(`kfs:folders`);
      client.rpush(`kfs:folders`, ["", 0, "047mpcup", transactions]);

      return { failed };
    } else {
      return new RPCError({
        code: "SERVER_ERROR",
        message: "This function can only be run in development.",
      });
    }
  }),
};

/*
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
        copyCollection("documents", { fromDb: "kfs2-hyz7", toDb: "kfs-hyz7", transform });

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

        return success("true");
      } else {
        return error({
          message: "This function can only be run in development.",
        });
      }
    },
  }),
});
*/
