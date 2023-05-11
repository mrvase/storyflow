import { error, success } from "@storyflow/rpc-server/result";
import { createProcedure, createRoute } from "@storyflow/rpc-server/router";
import { cors as corsFactory } from "@storyflow/server/middleware";
import { AuthCookies, serializeAuthToken } from "@storyflow/server/auth";
import {
  GLOBAL_TOKEN,
  LOCAL_SESSION_COOKIE,
  LOCAL_TOKEN,
  parseAuthToken,
} from "@storyflow/server/auth";
import { globals } from "../globals";
import { z } from "zod";
import { getClientPromise } from "../mongoClient";
import { DBFolderRecord } from "@storyflow/cms/types";
import { StoryflowConfig } from "@storyflow/shared/types";
import { createRawTemplateFieldId } from "@storyflow/cms/ids";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";

const validate = async (email: string, admin: string) => {
  console.log("validate", email, admin);
  if (email === admin) {
    return true;
  }
  const promise = await getClientPromise();
  const result = await promise
    .db()
    .collection("documents")
    .findOne({
      [`values.${createRawTemplateFieldId(DEFAULT_FIELDS.user.id)}`]: email,
    });
  return Boolean(result);
};

export const admin = (config: StoryflowConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return createRoute({
    authenticate: createProcedure({
      middleware(ctx) {
        return ctx.use(corsFactory(config.api.cors));
      },
      schema() {
        return z.object({
          key: z.boolean(),
          config: z.boolean(),
        });
      },
      async mutation(include, { request, response }) {
        try {
          const tokenHeader = (
            request.headers.get("authorization") ?? ""
          ).replace("Bearer ", "");

          const token = parseAuthToken(
            GLOBAL_TOKEN,
            tokenHeader,
            config.api.storyflowKey
          );

          if (!token) {
            return error({
              message: tokenHeader ? "Token not valid" : "Not authenticated",
            });
          }

          const email = token.email;

          const isValidated = await validate(email, config.auth.admin);

          if (!isValidated) {
            return error({ message: "Not authenticated", status: 401 });
          }

          return success({
            token: serializeAuthToken({ email }, config.auth.privateKey),
            ...(include.config && {
              config: {
                apps: config.apps,
                workspaces: config.workspaces.map(({ name }) => ({ name })),
              },
            }),
            ...(include.key && { key: config.api.publicKey }),
          });
        } catch (err) {
          console.log(err);
          return error({ message: "Lykkedes ikke", detail: err });
        }
      },
    }),

    getOffset: createProcedure({
      middleware(ctx) {
        return ctx.use(globals(config.api));
      },
      schema() {
        return z.object({
          name: z.union([
            z.literal("id"),
            z.literal("template"),
            z.literal("field"),
          ]),
          size: z.number(),
        });
      },
      async query({ name, size }) {
        const db = (await getClientPromise()).db(dbName);

        const counter = await db
          .collection<{ name: string; counter: number }>("counters")
          .findOneAndUpdate({ name }, { $inc: { counter: size } });

        if (!counter.ok) {
          console.log("failed");
          throw new Error("Failed creating folder");
        }

        const result = (counter.value ?? { counter: 0 }).counter;

        return success(result);
      },
    }),

    getFolders: createProcedure({
      middleware(ctx) {
        return ctx.use(globals(config.api));
      },
      async query(_) {
        const db = (await getClientPromise()).db(dbName);

        const folders = await db
          .collection<{
            name: "folders";
            value: DBFolderRecord;
            version: number;
          }>("counters")
          .findOne({ name: "folders" });

        return success({
          record: folders?.value ?? {},
          version: folders?.version ?? 0,
        });
      },
    }),
  });
};
