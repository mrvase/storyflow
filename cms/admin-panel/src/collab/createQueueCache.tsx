import { clone } from "../utils/clone";
import { TransactionEntry } from "@storyflow/collab/types";
import { Queue } from "@storyflow/collab/Queue";

export function createQueueCache<T>(initialValue: T, tracker?: object) {
  // if not cloned, we will mutate the initialValue
  // which will give problems with double render.
  let cached = clone(initialValue);
  let index = -1;
  return function cache<TE extends TransactionEntry>(
    forEach: Queue<TE>["forEach"],
    callback: (
      prev: T,
      entry: Parameters<Parameters<Queue<TE>["forEach"]>[0]>[0]
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
      } else if (timelineIndex <= index) {
        return;
      } else {
        newIndex = Math.max(newIndex, timelineIndex);
      }

      current = callback(current, entry);

      if (timelineIndex === null && tracker) {
        // must be added after the callback has run
        entry.trackers?.add(tracker);
      }
    });
    if (!saved) {
      // if there has not yet been any local-only operations
      cached = clone(current);
    }
    index = newIndex;
    return current;
  };
}
