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

export const admin = (config: StoryflowConfig) => {
  const dbName = undefined; // config.workspaces[0].db;
  return createRoute({
    authenticate: createProcedure({
      middleware(ctx) {
        return ctx.use(corsFactory(config.api.cors));
      },
      async mutation(_, { request, response }) {
        try {
          let session = request
            .cookies<AuthCookies>()
            .get(LOCAL_SESSION_COOKIE)?.value;

          const tokenHeader = request.headers.get("x-storyflow-token");

          if (!session) {
            session = parseAuthToken(
              GLOBAL_TOKEN,
              tokenHeader,
              config.api.storyflowKey
            );
            if (!session) {
              return error({
                message: tokenHeader ? "Token not valid" : "Not authenticated",
              });
            }
            // TODO validate!!
            response
              .cookies<AuthCookies>()
              .set(
                LOCAL_SESSION_COOKIE,
                { email: session.email },
                { path: "/", httpOnly: true, sameSite: "lax", secure: true }
              );
          }

          response
            .cookies<AuthCookies>()
            .set(
              LOCAL_TOKEN,
              serializeAuthToken(
                { email: session.email },
                config.auth.privateKey
              ),
              { path: "/" }
            );

          /*
          const cookie = serializeAuthCookie(
            LOCAL_TOKEN,
            { email: session.email },
            config.api.privateKey
          );

          cookies.push(cookie);

          res.setHeader("Set-Cookie", cookies.join(", "));
          */

          return success(
            tokenHeader
              ? {
                  apps: config.apps,
                  workspaces: config.workspaces.map(({ name }) => ({ name })),
                }
              : null
          );
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
