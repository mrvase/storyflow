import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { globals } from "../middleware/globals";
import { z } from "zod";
import { RawDocumentId } from "@storyflow/shared/types";
import { TimelineEntry, ToggleOperation } from "@storyflow/collab/types";
import { client } from "./redis-client";
import { getId, read } from "@storyflow/collab/utils";
import {
  ZodSpliceOperation,
  ZodTimelineEntry,
  ZodToggleOperation,
  ZodTransaction,
} from "./zod";

const modifyValues = <T extends any, V extends Record<string, any>>(
  obj: V,
  callback: (val: any, key: string, index: number) => T
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value], index) => [
      key,
      callback(value, key, index),
    ])
  ) as Record<string, T>;

const createDocumentsTimeline = (set: string[] | undefined) => {
  return set
    ? set.map((el: string) => {
        const [folder, id] = el.split("/");
        const entry: TimelineEntry = [
          "",
          0,
          "",
          [[folder, [["add", id] as ToggleOperation]]],
        ];
        return entry;
      })
    : [];
};

export const collab = createRoute({
  /*
  getGlobalTimelines: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    async query(_, { slug }) {
      try {
        const pipeline = client.pipeline();
        pipeline.lrange(`${slug}:folders`, 0, -1);
        pipeline.smembers(`${slug}:documents`);
        const result = await pipeline.exec();
        return success([
          result[0],
          createDocumentsTimeline(result[1] as string[] | undefined),
        ] as [folders: TimelineEntry[], documents: TimelineEntry[]]);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
  getTimeline: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.string();
    },
    async query(input, { slug }) {
      try {
        const result = ((await client.lrange(`${slug}:${input}`, 0, -1)) ??
          []) as TimelineEntry[];
        return success(result);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
  */
  sync: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.record(
        z.string(), // timeline
        z.object({
          entries: z.array(
            ZodTimelineEntry(
              ZodTransaction(
                z.union([
                  ZodSpliceOperation(z.any()),
                  ZodToggleOperation(z.any()),
                  z.any(),
                ])
              )
            )
          ),
          startId: z.string().nullable(),
          length: z.number(),
        })
      );
    },
    async mutation(input, { slug }) {
      try {
        const inputEntries = Object.entries(input);

        if (inputEntries.length === 0) {
          return success({});
        }

        const pipeline = client.pipeline();

        let commands = 0;

        inputEntries.map(([key, { entries }]) => {
          if (entries.length) {
            if (key === "documents") {
              const add: string[] = [];
              const remove: string[] = [];
              entries.forEach((timelineEntry) => {
                read(timelineEntry).transactions.forEach((transaction) => {
                  transaction.map((entry) => {
                    const folder = entry[0];
                    entry[1].map((operation: any) => {
                      const action = operation[0];
                      const id = operation[1];
                      if (action === "add") {
                        add.push(`${folder}/${id}`);
                      } else if (action === "remove") {
                        remove.push(`${folder}/${id}`);
                      }
                    });
                  });
                });
              });
              if (add.length) {
                pipeline.sadd(`${slug}:documents`, ...add);
                commands++;
              }
              if (remove.length) {
                pipeline.srem(`${slug}:documents`, ...remove);
                commands++;
              }
            } else {
              pipeline.rpush(
                `${slug}:${key}`,
                ...entries.map((el) => JSON.stringify(el))
              );
              commands++;
            }
          }
        });

        inputEntries.forEach(([key]) => {
          if (key.endsWith("documents")) {
            pipeline.smembers(`${slug}:documents`);
          } else {
            pipeline.lrange(`${slug}:${key}`, 0, -1);
          }
        });

        const result = (await pipeline.exec()).slice(commands);

        const timelines = Object.fromEntries(
          result.map((value, index) => [
            inputEntries[index][0],
            (value ?? []) as TimelineEntry[],
          ])
        );

        const output = modifyValues(timelines, (timeline, key) => {
          if (key === "documents") {
            console.log("TIMELINE", timeline);
            return {
              status: "stale" as "stale",
              updates: createDocumentsTimeline(timeline),
            };
          }
          const { startId, length } = input[key];
          const isStale = startId !== null && startId !== getId(timeline[0]);
          return {
            status: (isStale ? "stale" : "success") as "stale" | "success",
            updates: isStale ? timeline : timeline.slice(length),
          };
        });

        return success(output);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
  update: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        id: z.string(), // timeline
        index: z.number(),
      });
    },
    async mutation(input, { slug }) {
      const pipeline = client.pipeline();

      pipeline.ltrim(`${slug}:${input.id}`, input.index, -1);
      pipeline.lrange(`${slug}:${input.id}`, 0, -1);

      const result = await pipeline.exec();
      return success(result[1] as []);
    },
  }),
});
