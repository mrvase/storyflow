import {
  createAPI,
  createHandler,
  createProcedure,
  createRoute,
  MiddlewareContext,
} from "@sfrpc/server";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import type {} from "@sfrpc/types";
import { authenticator, authorizer } from "./auth";
import { error, isError, success, unwrap } from "@storyflow/result";
import clientPromise from "./mongo";
import { Organization, User } from "../types";

declare module "@sfrpc/server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}

const user = async ({ req }: MiddlewareContext) => {
  const user = await authorizer.authorize(req);

  if (isError(user)) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  return {
    user: unwrap(user),
  };
};

export const api = createAPI({
  users: createRoute({
    getUser: createProcedure({
      middleware(ctx) {
        return ctx.use(user);
      },
      async query(_, { user, req }) {
        return success(user);
      },
    }),

    /*
    getOrganization: createProcedure({
      middleware(ctx) {
        return ctx.use(user);
      },
      async query(slug, { user, req }) {
        const org = user.organizations.find((el) => el.slug === slug);

        if (!org) {
          return error({ message: "User has not unlocked the organization" });
        }

        return success(org);
      },
    }),
    */

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
          .findOne<{ name: string; slug: string; db: string; admin: string }>({
            slug,
          });

        console.log("org", slug, organization);

        if (!organization) {
          return error({ message: "Organization does not exist" });
        }

        const createCallback = (org: Organization) => (user: User) => ({
          ...user,
          organizations: [
            ...user.organizations.filter((el) => el.slug === slug),
            org,
          ],
        });

        if (organization.admin === user.email) {
          await authenticator.modifyUser(
            { request: req, response: res },
            createCallback({
              slug,
              db: organization.db,
              permissions: {},
            })
          );
        } else {
          const orgUser = await client
            .db(organization.db)
            .collection("articles")
            .findOne({
              [`values.${"abcd"}`]: user.email,
            });

          if (!orgUser) {
            return error({ message: "Organization does not have user" });
          }

          await authenticator.modifyUser(
            { request: req, response: res },
            createCallback({
              slug,
              db: organization.db,
              permissions: {}, // orgUser.values["abcd"] ?? false,
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
          email: z.string(),
        });
      },
      async mutation({ next, email }, ctx) {
        return await authenticator.authenticate(
          "email-link",
          {
            response: ctx.res,
            request: ctx.req,
          },
          {
            email,
            ...(next && {
              params: {
                next,
              },
            }),
          }
        );
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
        console.log("ABOUT TO VERIFY", token);
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
  }),
});

export const handler = createHandler(api, "users");

export type UserAPI = typeof api;
