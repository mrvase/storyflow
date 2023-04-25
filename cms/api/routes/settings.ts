import { createProcedure, createRoute } from "@sfrpc/server";
import { error, success } from "@storyflow/result";
import { z } from "zod";
import { globals } from "../middleware/globals";
import clientPromise from "../mongo/mongoClient";
import { authenticator } from "../users/auth";
import { modifyOrganization } from "../users/users";
import bcrypt from "bcryptjs";
import { Settings } from "../types";

export const settings = createRoute({
  get: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { slug }) {
      const client = await clientPromise;

      const org = await client
        .db("cms")
        .collection("organizations")
        .findOne<{ settings?: Settings }>({
          slug,
        });

      return success(org?.settings);
    },
  }),
  set: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        domains: z.array(z.object({ id: z.string(), configUrl: z.string() })),
      });
    },
    async mutation(settings, { slug }) {
      const client = await clientPromise;

      await client.db("cms").collection("organizations").updateOne(
        {
          slug,
        },
        {
          $set: {
            settings,
          },
        }
      );

      return success(true);
    },
  }),
  changeVersion: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({ slug: z.string(), version: z.number() });
    },
    async mutation({ slug, version }, { req, res }) {
      const client = await clientPromise;

      const organization = await client
        .db("cms")
        .collection("organizations")
        .findOne<{
          name: string;
          slug: string;
          dbs: Record<number, string>;
          admin: string;
        }>({
          slug,
        });

      const db = organization?.dbs?.[version];

      if (!db) {
        return error({ message: "Version does not exist", status: 400 });
      }

      await authenticator.modifyUser(
        { request: req, response: res },
        modifyOrganization({
          slug,
          db,
          version,
          permissions: {},
        })
      );

      return success(true);
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
