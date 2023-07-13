import { RPCError } from "@nanorpc/server";
import { cors as corsFactory } from "@storyflow/server/rpc";
import { serializeAuthToken } from "@storyflow/server/auth";
import { GLOBAL_TOKEN, parseAuthToken } from "@storyflow/server/auth";
import { globals } from "../globals";
import { z } from "zod";
import { client } from "../mongo";
import { CollabVersion, DBFolderRecord } from "@storyflow/cms/types";
import { StoryflowConfig } from "@storyflow/shared/types";
import { createRawTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import { procedure } from "@storyflow/server/rpc";
import { getCustomFolders } from "../collections/convert";

const validate = async (email: string, admin: string) => {
  console.log("validate", email, admin);
  if (email === admin) {
    return true;
  }
  const db = await client.get();
  const result = await db.collection("documents").findOne({
    [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.user.id)}`]: email,
  });
  return Boolean(result);
};

const httpOnly = procedure.middleware(async (input, ctx, next) => {
  const req = ctx.req;
  const res = ctx.res;
  if (!req || !res) {
    return new RPCError({
      code: "SERVER_ERROR",
      message: "This endpoint should only be used with an API request",
    });
  }
  return await next(input, { ...ctx, req, res });
});

export const admin = (config: StoryflowConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return {
    authenticate: procedure
      .use(corsFactory(config.api.cors))
      .use(httpOnly)
      .schema(
        z.object({
          key: z.boolean(),
          config: z.boolean(),
        })
      )
      .mutate(async (include, { req }) => {
        try {
          console.log("authenticating");

          const tokenHeader = (req.headers.get("authorization") ?? "").replace(
            "Bearer ",
            ""
          );

          const token = parseAuthToken(
            GLOBAL_TOKEN,
            tokenHeader,
            config.api.storyflowKey
          );

          if (!token) {
            return new RPCError({
              code: "UNAUTHORIZED",
              message: tokenHeader ? "Token not valid" : "Not authenticated",
            });
          }

          const email = token.email;

          const isValidated = await validate(email, config.auth.admin);

          if (!isValidated) {
            return new RPCError({
              code: "UNAUTHORIZED",
              message: "Not authenticated",
              status: 401,
            });
          }

          return {
            token: serializeAuthToken({ email }, config.auth.privateKey),
            ...(include.config && {
              config: {
                apps: config.apps,
                workspaces: config.workspaces.map(({ name }) => ({ name })),
              },
            }),
            ...(include.key && { key: config.api.publicKey }),
          };
        } catch (err) {
          console.log(err);
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Lykkedes ikke",
          });
        }
      }),

    allowUploads: procedure
      .use(corsFactory(config.api.cors))
      .use(httpOnly)
      .mutate(async () => {
        return config.allowUploads ?? false;
      }),

    getOffset: procedure
      .use(globals(config.api))
      .schema(
        z.object({
          name: z.union([
            z.literal("id"),
            z.literal("template"),
            z.literal("field"),
          ]),
          size: z.number(),
        })
      )
      .mutate(async ({ name, size }) => {
        const db = await client.get(dbName);

        const counter = await db
          .collection<{ name: string; counter: number }>("counters")
          .findOneAndUpdate({ name }, { $inc: { counter: size } });

        if (!counter.ok) {
          console.log("failed");
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Failed creating folder",
          });
        }

        const result = (counter.value ?? { counter: 0 }).counter;

        return result;
      }),

    getFolders: procedure.use(globals(config.api)).query(async () => {
      const db = await client.get(dbName);

      const folders = await db
        .collection<{
          name: "folders";
          value: DBFolderRecord;
          version: CollabVersion;
        }>("counters")
        .findOne({ name: "folders" });

      const record = folders?.value ?? {};

      Object.assign(record, getCustomFolders(config));

      return {
        record,
        version: folders?.version ?? ([0] as [0]),
      };
    }),
  };
};
