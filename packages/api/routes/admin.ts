import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { cors as corsFactory } from "@storyflow/server/middleware";
import { getHeader } from "@storyflow/server/utils";
import {
  GLOBAL_TOKEN,
  LOCAL_SESSION,
  LOCAL_TOKEN,
  parseAuthCookie,
  parseAuthToken,
  serializeAuthCookie,
} from "@storyflow/server/auth";
import { globals } from "../globals";
import { z } from "zod";
import { getClientPromise } from "../mongoClient";
import { DBFolderRecord } from "@storyflow/cms/types";
import { StoryflowConfig } from "@storyflow/shared/types";

export const admin = (config: StoryflowConfig) => {
  const dbName = config.workspaces[0].db;
  return createRoute({
    authenticate: createProcedure({
      middleware(ctx) {
        return ctx.use(corsFactory(["http://localhost:5173"]));
      },
      async mutation(_, { res, req }) {
        const cookies: string[] = [];
        try {
          let session = parseAuthCookie(
            LOCAL_SESSION,
            getHeader(req as any, "cookie")
          );

          console.log("ADMIN HAS COOKIE", session);

          const tokenHeader = getHeader(req as any, "X-Storyflow-Token");

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
            const cookie = serializeAuthCookie(LOCAL_SESSION, {
              email: session.email,
            });
            console.log("SETTING LOCAL SESSION", cookie);
            cookies.push(cookie);
          }

          const cookie = serializeAuthCookie(
            LOCAL_TOKEN,
            { email: session.email },
            config.api.privateKey
          );

          cookies.push(cookie);

          res.setHeader("Set-Cookie", cookies.join(", "));

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
        return ctx.use(globals);
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
        return ctx.use(globals);
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
