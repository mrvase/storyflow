import { createProcedure, createRoute, MiddlewareContext } from "@sfrpc/server";
import { z } from "zod";
import type {} from "@sfrpc/types";
import { authenticator, authorizer } from "./auth";
import { error, isError, success, unwrap } from "@storyflow/result";
import { clientPromise } from "../mongo/mongoClient";
import type { Organization, User } from "../types";
import { DEFAULT_FIELDS } from "@storyflow/fields-core/default-fields";
import type { DBFolderRaw } from "@storyflow/db-core/types";
import { ROOT_FOLDER, TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import { createRawTemplateFieldId } from "@storyflow/fields-core/ids";
import { createObjectId } from "@storyflow/db-core/mongo";

const user = async ({ req, client }: MiddlewareContext) => {
  const user = await authorizer.authorize(req);

  if (isError(user)) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  return {
    user: unwrap(user),
  };
};

type OrganizationDB = {
  name: string;
  slug: string;
  dbs: Record<number, string>;
  admin: string;
  version: number;
};

export const modifyOrganization = (org: Organization) => (user: User) => ({
  ...user,
  organizations: [
    ...user.organizations.filter((el) => el.slug !== org.slug),
    org,
  ],
});

export const users = createRoute({
  getUser: createProcedure({
    middleware(ctx) {
      return ctx.use(user);
    },
    async query(_, { user, req }) {
      return success(user);
    },
  }),

  createOrganization: createProcedure({
    middleware(ctx) {
      return ctx.use(user);
    },
    schema() {
      return z.object({
        slug: z.string(),
        admin: z.string().optional(),
        version: z.number().optional(),
      });
    },
    async mutation({ slug, admin, version }, { user }) {
      if (user.email !== "martin@rvase.dk") {
        return error({ message: "Access denied", status: 401 });
      }

      const client = await clientPromise;
      const db = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

      await Promise.all([
        client
          .db(db)
          .collection("counters")
          .insertMany([
            { name: "id", counter: 0 },
            { name: "template", counter: 0 },
            { name: "field", counter: 0 },
          ]),
        client
          .db(db)
          .collection<DBFolderRaw>("folders")
          .insertMany([
            {
              _id: createObjectId(ROOT_FOLDER),
              label: "Hjem",
              type: "data",
              spaces: [],
            },
            {
              _id: createObjectId(TEMPLATE_FOLDER),
              label: "Skabeloner",
              type: "data",
              spaces: [],
            },
          ]),
        client
          .db("cms")
          .collection("organizations")
          .updateOne(
            {
              slug,
            },
            [
              {
                $set: {
                  admin: admin || "martin@rvase.dk",
                  [`dbs.${version ?? 0}`]: {
                    $ifNull: [`$dbs.${version ?? 0}`, db],
                  },
                  version: { $ifNull: ["$version", version ?? 0] },
                },
              },
            ],
            {
              upsert: true,
            }
          ),
      ]);

      return success(slug);
    },
  }),

  verifyOrganization: createProcedure({
    schema() {
      return z.object({
        slug: z.string(),
        user: z.object({
          email: z.string(),
          organizations: z.array(z.any()),
        }),
      });
    },
    async query({ slug, user }, { req, res }) {
      const org = user.organizations.find((el) => el.slug === slug);

      if (org && "permissions" in org) {
        if (org.permissions === false) {
          return error({ message: "Not authorized.", status: 401 });
        } else {
          return success(user);
        }
      }

      const client = await clientPromise;

      const organization = await client
        .db("cms")
        .collection("organizations")
        .findOne<OrganizationDB>({
          slug,
        });

      if (!organization) {
        return error({ message: "Organization does not exist" });
      }

      const db = organization.dbs[organization.version];

      if (organization.admin === user.email) {
        await authenticator.modifyUser(
          { request: req, response: res },
          modifyOrganization({
            slug,
            db,
            version: organization.version,
            permissions: {},
          })
        );
      } else {
        const orgUser = await client
          .db(db)
          .collection("documents")
          .findOne({
            [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.user.id)}`]:
              user.email,
          });

        if (!orgUser) {
          return error({ message: "Organization does not have user" });
        }

        await authenticator.modifyUser(
          { request: req, response: res },
          modifyOrganization({
            slug,
            db,
            version: organization.version,
            permissions: {}, // orgUser.values["permissions"] ?? false,
          })
        );
      }

      return success(user);
    },
  }),

  getOrganization: createProcedure({
    middleware(ctx) {
      return ctx.use(user);
    },
    async query(_, { user, req }) {
      return success(user);
    },
  }),

  sendLink: createProcedure({
    schema() {
      return z.object({
        next: z.string().optional(),
        invite: z.string().optional(),
        email: z.string(),
      });
    },
    async mutation({ next, email, invite }, ctx) {
      const result = await authenticator.authenticate(
        "email-link",
        {
          response: ctx.res,
          request: ctx.req,
        },
        {
          email,
          ...(invite && { invite }),
          ...(next && {
            params: {
              next,
            },
          }),
        }
      );
      return result;
    },
  }),

  register: createProcedure({
    schema() {
      return z.object({
        name: z.string(),
        email: z.string(),
      });
    },
    async mutation({ email, name }, ctx) {
      return await authenticator.authenticate(
        "email-link",
        {
          response: ctx.res,
          request: ctx.req,
        },
        {
          email,
          register: name,
        }
      );
    },
  }),

  verifyLink: createProcedure({
    schema() {
      return z.string();
    },
    async mutation(token, { req, res }) {
      return await authenticator.authenticate(
        "email-link",
        {
          request: req,
          response: res,
        },
        {
          token,
        }
      );
    },
  }),

  logout: createProcedure({
    async mutation(_, { res, req }) {
      return await authenticator.logout({
        request: req,
        response: res,
      });
    },
  }),
});
