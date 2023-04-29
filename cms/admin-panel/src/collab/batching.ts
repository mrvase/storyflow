import { isError, Result, unwrap } from "@storyflow/result";
import type { Timeline } from "@storyflow/collab/Timeline";
import type { TimelineEntry } from "@storyflow/collab/types";

export function purgeTimelines(timelines: Map<string, Timeline>) {
  Array.from(timelines.entries()).forEach(([id, timeline]) => {
    if (timeline.isInactive()) {
      timelines.delete(id);
    }
  });
}

const createPromise = <T>() => {
  let props: {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } = {} as any;
  const promise = new Promise((res, rej) => {
    props.resolve = res;
    props.reject = rej;
  }) as Promise<T> & typeof props;
  Object.assign(promise, props);
  return promise;
};

export async function batchSyncTimelines(
  timelines: Map<string, Timeline>,
  mutation: (
    input: Record<
      string,
      { entries: TimelineEntry[]; startId: string | null; length: number }
    >
  ) => Promise<
    Result<
      Record<string, { status: "success" | "stale"; updates: TimelineEntry[] }>
    >
  >
) {
  type Response =
    | { status: "success" | "stale"; updates: TimelineEntry[] }
    | { status: "error" };

  const timelineHandlers: {
    id: string;
    entries: TimelineEntry[];
    state: { startId: string | null; length: number };
    promise: ReturnType<typeof createPromise<Response>>;
  }[] = [];

  const callback = (
    entries: TimelineEntry[],
    state: { startId: string | null; length: number },
    id: string
  ) => {
    // returns a resolvable promise object that we resolve afterwards

    const promise = createPromise<Response>();

    timelineHandlers.push({
      id,
      entries,
      state,
      promise,
    });

    return promise;
  };

  timelines.forEach((timeline, id) =>
    timeline.sync((entries, state) => callback(entries, state, id))
  );

  // create input record

  const input = timelineHandlers.reduce((acc, { id, entries, state }) => {
    if (entries.length) {
      acc[id] = { entries, ...state };
    }
    return acc;
  }, {} as Record<string, { entries: TimelineEntry[]; startId: string | null; length: number }>);

  const result = await mutation(input);

  // resolve promises

  timelineHandlers.forEach(({ id, promise }) => {
    if (isError(result)) {
      promise.resolve({ status: "error" });
    } else {
      promise.resolve(unwrap(result)[id] ?? { status: "success", updates: [] });
    }
  });

  return result;
}
