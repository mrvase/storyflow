import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import bcrypt from "bcryptjs";
import clientPromise from "../mongo/mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "../middleware/cors";

import { createSessionStorage } from "@storyflow/session";
import { cookieOptions } from "../cookie-options";
import { error, success } from "@storyflow/result";
import { createFieldRecordGetter } from "@storyflow/fields-core/get-field-record";
import { calculateRootFieldFromRecord } from "@storyflow/fields-core/calculate-server";
import type {} from "@storyflow/shared/types";
import { RawFieldId, ValueArray } from "@storyflow/shared/types";
import { DBDocumentRaw } from "@storyflow/db-core/types";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import { ObjectId } from "mongodb";
import { parseDocument } from "../routes/documents";
import {
  createRawTemplateFieldId,
  createTemplateFieldId,
} from "@storyflow/fields-core/ids";
import util from "node:util";
import { FolderId } from "@storyflow/shared/types";

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

const authorization = async (ctx: MiddlewareContext) => {
  const session = await sessionStorage.get(ctx.req.headers["cookie"]);

  let user: { slug: string; db: string } | null =
    session.get("api-user") ?? null;

  if (!user) {
    let auth = ctx.req.headers["x-storyflow"] as string;

    if (!auth) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    auth = auth.replace("Basic ", "");

    const result = Buffer.from(auth, "base64").toString();

    const [domainIdAndSlug, key] = result.split(":");
    const [domainId, slug] = domainIdAndSlug.split("@");

    const organization = await (await clientPromise)
      .db("cms")
      .collection("organizations")
      .findOne({ slug });

    console.log("**** GETTING ORGANIZATION");

    if (!organization) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    const fromDb = organization.keys[domainId] as string | undefined;

    if (!fromDb) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    const success = await bcrypt.compare(key, fromDb);

    if (!success) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    user = {
      slug: organization.slug,
      db: organization.dbs[organization.version],
    };

    session.set("user-api", user);
    const cookie = await sessionStorage.commit(session);
    ctx.res.setHeader("Set-Cookie", cookie);
  }

  return {
    slug: user!.slug,
    dbName: user!.db,
  };
};

const createFetcher =
  (dbName: string) =>
  async (fetchObject: {
    folder: FolderId;
    filters: Record<RawFieldId, ValueArray>;
    limit: number;
  }) => {
    const client = await clientPromise;
    const result = await client
      .db(dbName)
      .collection<DBDocumentRaw>("documents")
      .find({
        folder: new ObjectId(fetchObject.folder),
        ...fetchObject.filters,
      })
      .sort({ _id: -1 })
      .limit(fetchObject.limit)
      .toArray();

    return result.map(parseDocument);
  };

export const public_ = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({
        namespaces: z.array(z.union([z.string(), z.number()])).optional(),
        url: z.string(),
      });
    },
    async query({ namespaces, url }, { dbName }) {
      console.log("REQUESTING PAGE", dbName, url);

      const client = await clientPromise;

      const regex = `^${url
        .split("/")
        .map((el, index) => (index === 0 ? el : `(${el}|\\*)`))
        .join("/")}$`;

      const docRaw = await client
        .db(dbName)
        .collection("documents")
        .findOne<DBDocumentRaw>({
          ...(namespaces &&
            namespaces.length > 0 && {
              folder: {
                $in: namespaces.map(
                  (el) => new ObjectId(`${el}`.padStart(24, "0"))
                ),
              },
            }),
          [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]:
            url.indexOf("/") < 0
              ? url
              : {
                  $regex: regex,
                },
        });

      if (!docRaw) {
        console.log("NO PAGE");
        return success(null);
      }

      const doc = parseDocument(docRaw);

      const params = Object.fromEntries(
        url
          .split("/")
          .reverse()
          .map((el, index) => [`param${index}`, [el]])
      );

      const getFieldRecord = createFieldRecordGetter(
        doc.record,
        {
          ...params,
        },
        createFetcher(dbName)
      );

      const [pageRecord, layoutRecord] = await Promise.all([
        getFieldRecord(createTemplateFieldId(doc._id, DEFAULT_FIELDS.page.id)),
        getFieldRecord(
          createTemplateFieldId(doc._id, DEFAULT_FIELDS.layout.id)
        ),
      ]);

      const titleArray = calculateRootFieldFromRecord(
        createTemplateFieldId(doc._id, DEFAULT_FIELDS.label.id),
        doc.record
      );

      const result = {
        page: pageRecord,
        layout: layoutRecord,
        head: {
          ...(typeof titleArray[0] === "string" && { title: titleArray[0] }),
        },
      };

      console.log(
        "RESULT",
        util.inspect(result, { depth: null, colors: true })
      );

      return success(result);
    },
  }),
  getPaths: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({
        namespaces: z.array(z.union([z.string(), z.number()])).optional(),
      });
    },
    async query({ namespaces }, { dbName, slug }) {
      console.log("REQUESTING PATHS");

      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection<DBDocumentRaw>("documents")
        .find({
          ...(namespaces
            ? {
                folder: {
                  $in: namespaces.map(
                    (n) => new ObjectId(`${n}`.padStart(24, "0"))
                  ),
                },
              }
            : {
                [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.url.id)}`]: {
                  $exists: true,
                },
              }),
          /*
          [`values.${URL_ID}`]: namespace
            ? { $regex: `^${namespace}` }
            : { $exists: true },
          */
        })
        .toArray();

      const urls = articles
        .map((el) => {
          const doc = parseDocument(el);
          return {
            _id: doc._id,
            url: el.values[
              createRawTemplateFieldId(DEFAULT_FIELDS.url.id)
            ][0] as string,
            record: doc.record,
          };
        })
        .sort((a, b) => {
          if (a.url.length < b.url.length) {
            return -1;
          }
          if (a.url.length > b.url.length) {
            return 1;
          }
          return 0;
        });

      const dynamicUrls = urls.filter((el) => el.url.indexOf("*") > 0);
      const ordinaryUrls = urls.filter((el) => el.url.indexOf("*") < 0);

      const staticUrls = (
        await Promise.all(
          dynamicUrls.map(async ({ _id, url, record }) => {
            const fieldId = createTemplateFieldId(
              _id,
              DEFAULT_FIELDS.params.id
            );
            const tree = record[fieldId];

            const toUrl = (slug: string) => `${url.slice(0, -1)}${slug}`;

            if (
              tree.children.every((el): el is string => typeof el === "string")
            ) {
              return tree.children.map(toUrl);
            }

            // wrap in select
            record[fieldId] = {
              type: "select",
              children: [
                {
                  type: "fetch",
                  children: [record[fieldId]],
                  data: [100],
                },
              ],
              data: createRawTemplateFieldId(DEFAULT_FIELDS.slug.id),
            };

            const getFieldRecord = createFieldRecordGetter(
              record,
              {},
              createFetcher(dbName)
            );

            const slugs =
              (
                await getFieldRecord(
                  createTemplateFieldId(_id, DEFAULT_FIELDS.params.id)
                )
              )?.entry ?? [];

            if (!Array.isArray(slugs)) {
              throw new Error("Slugs cannot rely on client state");
            }

            if (slugs.every((el): el is string => typeof el === "string")) {
              return slugs.map(toUrl);
            }

            return [];
          })
        )
      ).flat(1);

      /*
      console.log("ORDINARY URLS", ordinaryUrls);
      console.log("DYNAMIC URLS", dynamicUrls);
      console.log("STATIC URLS", staticUrls);
      */

      return success([...ordinaryUrls.map((el) => el.url), ...staticUrls]);
    },
  }),
  /*
  search: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.string();
    },
    async mutation(query, { dbName }) {
      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection("documents")
        .aggregate([
          {
            $search: {
              index: dbName,
              text: {
                query,
                path: `values.${createRawTemplateFieldId(
                  DEFAULT_FIELDS.page.id
                )}`,
              },
              highlight: {
                path: `values.${createRawTemplateFieldId(
                  DEFAULT_FIELDS.page.id
                )}`,
              },
            },
          },
          {
            $project: {
              _id: 0,
              value: `$values.${createRawTemplateFieldId(
                DEFAULT_FIELDS.page.id
              )}`,
              score: { $meta: "searchScore" },
              highlight: { $meta: "searchHighlights" },
            },
          },
        ])
        .toArray();
      return success(articles as DBDocument[]);
    },
  }),
  */
});
