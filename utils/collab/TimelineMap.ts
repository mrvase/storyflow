import { isError, Result, unwrap } from "@storyflow/result";
import type { Timeline } from "./Timeline";
import type { TimelineEntry } from "./types";

export function createTimelineMap() {
  const timelines = new Map<string, Timeline>();

  return {
    get: (id: string) => {
      const queue = timelines.get(id);
      return queue as any;
    },
    set: (id: string, timeline: Timeline) => {
      timelines.set(id, timeline);
    },
    delete: (id: string) => {
      timelines.delete(id);
    },
    syncEach: (
      callback: (
        pkg: TimelineEntry[],
        state: { start: string | null; end: string | null },
        id: string
      ) => Promise<
        | { status: "success" | "stale"; updates: TimelineEntry[] }
        | { status: "error" }
      >
    ) => {
      timelines.forEach((timeline, id) =>
        timeline.sync((entries, state) => callback(entries, state, id))
      );
    },
    purge: () => {
      Array.from(timelines.entries()).forEach(([id, timeline]) => {
        if (timeline.isInactive()) {
          timelines.delete(id);
        }
      });
    },
  };
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

export async function syncTimelineMap(
  timelines: ReturnType<typeof createTimelineMap>,
  mutation: (
    input: Record<
      string,
      { entries: TimelineEntry[]; start: string | null; end: string | null }
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
    state: { start: string | null; end: string | null };
    promise: ReturnType<typeof createPromise<Response>>;
  }[] = [];

  const callback = (
    entries: TimelineEntry[],
    state: { start: string | null; end: string | null },
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

  timelines.syncEach(callback);

  // create input record

  const input = timelineHandlers.reduce((acc, { id, entries, state }) => {
    if (entries.length) {
      acc[id] = { entries, ...state };
    }
    return acc;
  }, {} as Record<string, { entries: TimelineEntry[]; start: string | null; end: string | null }>);

  const result = await mutation(input);

  // resolve promises

  timelineHandlers.forEach(({ id, promise }) => {
    if (isError(result)) {
      promise.resolve({ status: "error" });
    } else {
      promise.resolve(unwrap(result)[id]);
    }
  });

  return result;
}
