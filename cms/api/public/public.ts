import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import bcrypt from "bcryptjs";
import clientPromise from "../mongo/mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "../middleware/cors";

import { createSessionStorage } from "@storyflow/session";
import { cookieOptions } from "../cookie-options";
import { error, success } from "@storyflow/result";
import { globals } from "../middleware/globals";
import { fetchSinglePage } from "@storyflow/server";
import type {} from "@storyflow/frontend/types";
import { DBDocument, DBDocumentRaw } from "@storyflow/backend/types";
import { FIELDS } from "@storyflow/backend/fields";
import { ObjectId } from "mongodb";
import { parseDocument } from "../routes/documents";
import { getFieldRecord, getGraph } from "shared/computation-tools";
import { computeFieldId } from "@storyflow/backend/ids";

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

export const public_ = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({
        namespaces: z.array(z.string()).optional(),
        url: z.string(),
      });
    },
    async query({ namespaces, url }, { dbName }) {
      console.log("REQUESTING PAGE", dbName, url);
      const page = await fetchSinglePage(url, namespaces ?? [], dbName);
      return success(page);
    },
  }),
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
                path: `values.${FIELDS.page.id}`,
              },
              highlight: {
                path: `values.${FIELDS.page.id}`,
              },
            },
          },
          {
            $project: {
              _id: 0,
              value: `$values.${FIELDS.page.id}`,
              score: { $meta: "searchScore" },
              highlight: { $meta: "searchHighlights" },
            },
          },
        ])
        .toArray();
      return success(articles as DBDocument[]);
    },
  }),
  getPaths: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    schema() {
      return z.object({ namespaces: z.array(z.string()).optional() });
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
                folder: { $in: namespaces.map((n) => new ObjectId(n)) },
              }
            : { [`values.${FIELDS.url.id}`]: { $exists: true } }),
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
          const graph = getGraph(doc.record);
          return {
            _id: doc._id,
            url: el.values[FIELDS.url.id][0] as string,
            params: getFieldRecord(
              doc.record,
              computeFieldId(doc._id, FIELDS.params.id),
              graph
            ),
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

      /*
      const staticUrls = (
        await Promise.all(
          dynamicUrls.map(async ({ _id, url, params }) => {
            const getter = async (value: FetchObject | ContextToken) => {
              if ("select" in value) {
                // do fetch return docs

                return [];
              }
              return [];
            };

            const slugs = await calculateFromRecordAsync(
              computeFieldId(_id, FIELDS.params.id),
              params,
              getter
            );

            return slugs
              .map((el) =>
                typeof el === "string" ? `${url.slice(0, -1)}${el}` : undefined
              )
              .filter((el): el is Exclude<typeof el, undefined> => Boolean(el));
          })
        )
      ).flat(1);
      */

      console.log("GOT PATHS", ordinaryUrls);

      return success(ordinaryUrls.map((el) => el.url));
    },
  }),
  generateKey: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async mutation(domainId, { slug }) {
      const client = await clientPromise;

      const randomKey = `${Math.random()
        .toString(16)
        .substring(2, 14)}${Math.random().toString(16).substring(2, 14)}`;

      const hash = await bcrypt.hash(randomKey, 10);

      await client
        .db("cms")
        .collection("organizations")
        .updateOne(
          {
            slug,
          },
          {
            $set: {
              [`keys.${domainId}`]: hash,
            },
          }
        );

      return success(`${domainId}@${slug}:${randomKey}`);
    },
  }),
});
