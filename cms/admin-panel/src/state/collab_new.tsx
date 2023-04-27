import { onInterval } from "@storyflow/state";
import { clone } from "../utils/clone";
import { useSubject } from "./useSubject";
import {
  createTimelineMap,
  syncTimelineMap,
} from "@storyflow/collab/TimelineMap";
import { TimelineEntry, TransactionEntry } from "@storyflow/collab/types";
import { createTimeline } from "@storyflow/collab/Timeline";
import { getTransactionId } from "@storyflow/collab/utils";
import { Queue } from "@storyflow/collab/Queue";

export function createCollaboration(
  mutation: Parameters<typeof syncTimelineMap>[1],
  options: { duration?: number } = {}
) {
  const { duration = 3500 } = options;

  const timelines = createTimelineMap();

  let lastSync = 0;

  function throttle<T>(callback: () => T, time: number): T | undefined {
    if (Date.now() - lastSync > time) {
      return callback();
    }
  }

  const [registerEventListener, emitEvent] = useSubject<"loading" | "done">(
    "done"
  );

  const [registerMutationListener, emitMutation] = useSubject<string>("");

  const sync = async (force?: boolean) => {
    lastSync = Date.now();
    emitEvent("loading");
    const result = await syncTimelineMap(timelines, mutation);
    timelines.purge();
    emitEvent("done");
    return result;
  };

  const syncOnInterval = () => {
    return onInterval(
      (event) => {
        if (event === "unload" || event === "visibilitychange") {
          return sync(true);
        }
        return throttle(() => sync(false), duration / 2);
      },
      { duration }
    );
  };

  const getOrAddTimeline = (
    id: string,
    options: { transform?: (entries: TimelineEntry[]) => TimelineEntry[] } = {}
  ) => {
    let exists = timelines.get(id);
    if (!exists) {
      exists = timelines.set(id, createTimeline(options));
    }
    return exists;
  };

  const getTimeline = (id: string) => {
    return timelines.get(id);
  };

  return {
    sync,
    syncOnInterval,
    getTimeline,
    getOrAddTimeline,
    registerEventListener,
    registerMutationListener,
  };
}

export function createQueueCache<T, TE extends TransactionEntry>(
  initialValue: T
) {
  // if not cloned, we will mutate the initialValue
  // which will give problems with double render.
  let cached = clone(initialValue);
  let seen = new Set();
  let index = -1;
  return function cache(
    forEach: Queue<TE>["forEach"],
    callback: (
      prev: T,
      entry: Parameters<Parameters<Queue<TE>["forEach"]>[0]>[0],
      seen: boolean
    ) => T
  ) {
    let saved = false;
    let current = cached;
    let newIndex = index;
    forEach((entry) => {
      const timelineIndex = entry.timelineIndex;
      if (timelineIndex === null) {
        if (!saved) {
          saved = true;
          cached = clone(current);
        }
        seen.add(getTransactionId(entry));
      } else if (timelineIndex <= index) {
        return;
      } else {
        newIndex = Math.max(newIndex, timelineIndex);
      }
      current = callback(current, entry, seen.has(getTransactionId(entry)));
    });
    if (!saved) {
      // if there has not yet been any local-only operations
      cached = clone(current);
    }
    index = newIndex;
    return current;
  };
}
