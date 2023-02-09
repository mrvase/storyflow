import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import bcrypt from "bcryptjs";
import clientPromise from "../mongo/mongoClient";
import { z } from "zod";

import { cors as corsFactory } from "../middleware/cors";

import { createSessionStorage } from "@storyflow/session";
import { cookieOptions } from "../cookie-options";
import { User } from "../types";
import { error, success } from "@storyflow/result";
import { globals } from "../middleware/globals";
import { fetchSinglePage } from "@storyflow/server";
import { URL_ID } from "@storyflow/backend/templates";

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

const authorization = async (ctx: MiddlewareContext) => {
  const session = await sessionStorage.get(ctx.req.headers["cookie"]);

  let user: { slug: string; db: string } | null =
    session.get("api-user") ?? null;

  if (!user) {
    let auth = ctx.req.headers["authorization"];

    if (!auth) {
      throw error({ message: "Not authorized.", status: 401 });
    }

    auth = auth.replace("Basic ", "");

    const result = Buffer.from(auth, "base64").toString();

    const [domainIdAndSlug, key] = result.split(":");
    const [domainId, slug] = domainIdAndSlug.split("@");

    console.log("auth", domainId, slug, key);

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
      db: organization.dbs[1],
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
      return z.object({ url: z.string(), config: z.array(z.any()) });
    },
    async mutation({ url, config }, { dbName, slug }) {
      const page = await fetchSinglePage(url, dbName, config);
      return success(page);
    },
  }),
  getPaths: createProcedure({
    middleware(ctx) {
      return ctx.use(corsFactory("allow-all"), authorization);
    },
    async query(_, { dbName, slug }) {
      const client = await clientPromise;
      const articles = await client
        .db(dbName)
        .collection("articles")
        .find({
          [`values.${URL_ID}`]: { $exists: true },
        })
        .toArray();

      const urls = articles.map((el) => el.values[URL_ID][0] as string);

      return success(urls);
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
