import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { globals } from "../middleware/globals";
import { z } from "zod";
import { RawDocumentId } from "@storyflow/shared/types";
import { TimelineEntry } from "@storyflow/collab/types";
import { client, modifyValues } from "../collab-utils/redis-client";
import { getId } from "@storyflow/collab/utils";
import {
  ZodSpliceOperation,
  ZodTimelineEntry,
  ZodToggleOperation,
  ZodTransaction,
} from "./zod";

export const getTimelinesFromIds = async (
  slug: string,
  keys: RawDocumentId[]
) => {
  if (keys.length === 0) return {};

  let getPipeline = client.pipeline();

  keys.forEach((key) => {
    getPipeline.lrange(`${slug}:${key}`, 0, -1);
  });

  const result = await getPipeline.exec();

  const object = Object.fromEntries(
    result.map((value, index) => [
      keys[index],
      (value ?? []) as TimelineEntry[],
    ])
  );

  return object;
};

export const collab = createRoute({
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
  fields: createProcedure({
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
        let pipeline: ReturnType<typeof client.pipeline> | null = null;

        const entries = Object.entries(input);

        entries.map(([key, { entries }]) => {
          if (entries.length) {
            if (!pipeline) {
              pipeline = client.pipeline();
            }
            pipeline.rpush(
              `${slug}:${key}`,
              ...entries.map((el) => JSON.stringify(el))
            );
          }
        });

        if (pipeline) {
          await (pipeline as any).exec();
        }

        let timelines: Awaited<ReturnType<typeof getTimelinesFromIds>> = {};

        let keys = Object.keys(input);

        if (keys.length) {
          timelines = await getTimelinesFromIds(
            slug,
            Object.keys(input) as RawDocumentId[]
          );
        }

        const result = modifyValues(timelines, (timeline, key) => {
          const { startId, length } = input[key];
          const isStale = startId !== null && startId !== getId(timeline[0]);
          return {
            status: (isStale ? "stale" : "success") as "stale" | "success",
            updates: isStale ? timeline : timeline.slice(length),
          };
        });

        return success(result);
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),
});
