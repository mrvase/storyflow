import { batch } from "@storyflow/state";
import type { TimelineEntry, Transaction, TransactionEntry } from "./types";
import { Queue, createQueue } from "./Queue";
import { createQueueFromTimeline, filterTimeline, getId } from "./utils";

const randomUserId = Math.random().toString(36).slice(2, 10);

const absoluteVersion = (versions: Record<string, number>) =>
  Object.values(versions).reduce((a, b) => a + b, 0);

export function createTimeline(options: {
  transform?: (entries: TimelineEntry[]) => TimelineEntry[];
  user?: string;
}) {
  const { transform = (x) => x, user = randomUserId } = options;

  const state = {
    shared: [] as TimelineEntry[],
    posted: [] as TimelineEntry[],
    current: [] as TimelineEntry[],
    versions: {} as Record<string, number>,
    initialized: false,
    stale: false,
  };

  const queues = new Map<string, Queue>();
  const trackers = new WeakMap<Transaction, object>();

  function initialize(
    initialServerState: TimelineEntry[],
    initialVersions: Record<string, number>
  ) {
    if (
      !state.initialized ||
      absoluteVersion(initialVersions) > absoluteVersion(state.versions)
    ) {
      state.shared = transform(
        filterTimeline(initialServerState, initialVersions)
      );
      state.posted = [];
      state.current = [];
      state.versions = initialVersions;
      state.initialized = true;
      state.stale = false;
    }
  }

  function post() {
    if (!state.posted.length) return;
    state.posted = state.current;
    state.current = [];
  }

  function retract() {
    state.current = state.posted.concat(state.current);
    state.posted = [];
  }

  function pull(packages: TimelineEntry[]) {
    if (packages.length === 0) {
      return;
    }

    state.posted.forEach((entry) => {
      const id = getId(entry);
      const returned = packages.find((el) => getId(el) === id);
      if (returned) {
        const [, , , ...oldTransactions] = entry;
        const [, , , ...newTransactions] = returned;
        oldTransactions.forEach((old, index) => {
          const tracker = trackers.get(old);
          if (tracker) {
            trackers.delete(old);
            trackers.set(newTransactions[index], tracker);
          }
        });
      }
    });

    const newTimeline = filterTimeline(
      [...state.shared, ...packages, ...state.current],
      state.versions
    );

    const newShared = transform(newTimeline);

    const newCurrent = newShared.splice(
      newShared.length - 1,
      state.current.length
    );

    state.shared = newShared;
    state.posted = [];
    state.current = newCurrent;

    new Set(packages.map((el) => el[2])).forEach((queue) =>
      triggerListeners(queue)
    );
  }

  async function sync(
    callback: (
      upload: TimelineEntry[],
      state: { start: string | null; end: string | null }
    ) => Promise<
      | { status: "success" | "stale"; updates: TimelineEntry[] }
      | { status: "error" }
    >
  ) {
    if (state.posted.length > 0 || state.stale) {
      // is already posting
      return;
    }

    post();

    const result = await callback(state.current, {
      start: getId(state.shared[0]),
      end: getId(state.shared[state.shared.length - 1]),
    });

    if (result.status === "error") {
      console.log("RETRACT");
      retract();
    } else if (result.status === "stale") {
      console.log("STALE");
      state.stale = true;
      triggerStaleListeners();
    } else {
      pull(result.updates);
    }
  }

  const getQueueEntries = (queue: string) => {
    return createQueueFromTimeline(state.shared, [
      ...state.posted,
      ...state.current,
    ]).filter((entry) => entry.queue === queue);
  };

  const listeners = new Map<string, Set<() => void>>();

  function registerListener(queue: string, listener: () => void) {
    let set = listeners.get(queue);
    if (!set) {
      set = new Set([]);
      listeners.set(queue, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  function triggerListeners(queue: string) {
    batch(() => {
      listeners.get(queue)?.forEach((listener) => listener());
    });
  }

  const staleListeners = new Set<() => void>();

  function registerStaleListener(listener: () => void) {
    staleListeners.add(listener);
    return () => {
      staleListeners.delete(listener);
    };
  }

  function triggerStaleListeners() {
    staleListeners.forEach((listener) => listener());
  }

  const getVersion = (queue: string) => {
    return (state.versions[queue] ?? 0) + getQueueEntries(queue).length;
  };

  const createActions = (queue: string) => ({
    getState() {
      return {
        stale: state.stale,
        version: getVersion(queue),
      };
    },
    get() {
      return getQueueEntries(queue);
    },
    push(transactions: Transaction[], tracker?: object) {
      let entry = state.current[state.current.length - 1];
      if (entry[2] !== queue) {
        const prev = getVersion(queue);
        entry = [prev, user, queue];
        state.current.push(entry);
      }
      entry.push(...transactions);
      if (tracker) {
        transactions.forEach((transaction) => {
          trackers.set(transaction, tracker);
        });
      }
      triggerListeners(queue);
    },
    registerListener(listener: () => void) {
      return registerListener(queue, listener);
    },
  });

  function isInactive() {
    let size = 0;
    listeners.forEach((set) => (size += set.size));
    return (
      size === 0 && state.posted.length === 0 && state.current.length === 0
    );
  }

  return {
    initialize,
    sync,
    getQueue<TE extends TransactionEntry>(name: string) {
      let current = queues.get(name);
      if (!current) {
        current = createQueue(createActions(name));
        queues.set(name, current);
      }
      return current as unknown as Queue<TE>;
    },
    registerStaleListener,
    isInactive,
  };
}

export type Timeline = ReturnType<typeof createTimeline>;
