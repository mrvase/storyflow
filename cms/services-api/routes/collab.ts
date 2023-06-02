import { globals } from "../globals";
import { z } from "zod";
import { TimelineEntry, ToggleOperation } from "@storyflow/collab/types";
import { getId, read } from "@storyflow/collab/utils";
import { Redis } from "@upstash/redis";
import { procedure } from "@storyflow/server/rpc";
import { RPCError } from "@nanorpc/server";

const ZodTimelineEntry = <T extends z.ZodType>(Transaction: T) =>
  z.tuple([z.string(), z.number(), z.string()]).rest(Transaction);

const ZodTransaction = <T extends z.ZodType>(Operation: T) => {
  return z.array(z.tuple([z.string(), z.array(Operation)]));
};

const ZodSpliceOperation = <T extends z.ZodType>(Value: T) =>
  z.tuple([z.number(), z.number()]).rest(Value);

const ZodToggleOperation = <T extends z.ZodType>(Value: T) =>
  z.tuple([z.string(), Value]);

export const client = new Redis({
  url: "https://eu1-renewed-albacore-38555.upstash.io",
  token: process.env.UPSTASH_TOKEN as string,
});

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

export const collab = {
  sync: procedure
    .use(globals)
    .schema(
      z.record(
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
      )
    )
    .mutate(async (input, { slug }) => {
      try {
        const inputEntries = Object.entries(input);

        if (inputEntries.length === 0) {
          return {};
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

        return output;
      } catch (err) {
        console.log(err);
        return new RPCError({ code: "SERVER_ERROR", message: "Lykkedes ikke" });
      }
    }),
  update: procedure
    .use(globals)
    .schema(
      z.object({
        id: z.string(), // timeline
        index: z.number(),
      })
    )
    .mutate(async (input, { slug }) => {
      const pipeline = client.pipeline();

      pipeline.ltrim(`${slug}:${input.id}`, input.index, -1);
      pipeline.lrange(`${slug}:${input.id}`, 0, -1);

      const result = await pipeline.exec();

      return result[1] as [];
    }),
};
