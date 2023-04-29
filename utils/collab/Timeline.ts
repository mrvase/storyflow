import { batch } from "@storyflow/state";
import type { TimelineEntry, Transaction, TransactionEntry } from "./types";
import { Queue, createQueue } from "./Queue";
import { createQueueFromTimeline, filterTimeline, getId } from "./utils";
import { clone } from "./clone_debug";

const randomUserId = Math.random().toString(36).slice(2, 10);

const absoluteVersion = (versions: Record<string, number>) =>
  Object.values(versions).reduce((a, b) => a + b, 0);

const defaultTransform = (pkg: TimelineEntry[]) => pkg;

export function createTimeline(
  options: {
    user?: string;
  } = {}
) {
  const { user = randomUserId } = options;

  let transform = defaultTransform;

  const state = {
    shared: [] as TimelineEntry[],
    posted: [] as TimelineEntry[],
    current: [] as TimelineEntry[],
    versions: {} as Record<string, number>,
    initialized: false,
    stale: false,
    saving: false,
  };

  const queues = new Map<string, Queue>();
  const trackers = new WeakMap<Transaction, WeakSet<object>>();

  function initialize(data: {
    transform?: (entries: TimelineEntry[]) => TimelineEntry[];
    timeline: TimelineEntry[];
    versions: Record<string, number>;
  }) {
    console.log("INITIALIZING", data);
    if (
      !state.initialized ||
      absoluteVersion(data.versions) > absoluteVersion(state.versions)
    ) {
      transform = data.transform ?? defaultTransform;

      state.shared = transform(filterTimeline(data.timeline, data.versions));

      state.posted = [];
      state.current = [];
      state.versions = data.versions;
      state.initialized = true;
      state.stale = false;
      state.saving = false;
      console.log("INITIALIZED STATE", clone(state));
    }
    return self;
  }

  function post() {
    if (state.posted.length) return;
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

    const all = [...state.shared, ...packages, ...state.current];

    console.log("---ALL", clone(all));

    const newTimeline = filterTimeline(all, state.versions);

    console.log("---NEW TIMELINE", clone(newTimeline));

    const newShared = transform(newTimeline);

    console.log("---NEW SHARED", clone(newShared));

    const newCurrent = newShared.splice(
      state.shared.length + packages.length,
      state.current.length
    );

    console.log("---NEW ", {
      shared: clone(newShared),
      current: clone(newCurrent),
    });

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
      state: { startId: string | null; length: number }
    ) => Promise<
      | { status: "success" | "stale"; updates: TimelineEntry[] }
      | { status: "error" }
    >
  ) {
    if (state.saving || state.posted.length > 0 || state.stale) {
      return;
    }

    post();

    console.log("SYNC", clone(state));

    const result = await callback(state.posted, {
      startId: getId(state.shared[0]),
      length: state.shared.length,
    });

    if (state.saving || result.status === "error") {
      console.warn("RETRACT");
      retract();
    } else if (result.status === "stale") {
      console.warn("STALE");
      state.stale = true;
      triggerStaleListeners();
      state.current = state.posted;
      state.posted = [];
    } else {
      pull(result.updates);
    }
  }

  async function save(
    callback: (upload: TimelineEntry[]) => Promise<
      | {
          status: "success";
          data: {
            versions: Record<string, number>;
            timeline?: TimelineEntry[];
            transform?: (entries: TimelineEntry[]) => TimelineEntry[];
          };
        }
      | { status: "error" }
    >
  ) {
    state.saving = true;

    const result = await callback([
      ...state.shared,
      ...state.posted,
      ...state.current,
    ]);

    if (result.status === "error") {
      state.saving = false;
    } else {
      initialize({
        transform: result.data.transform,
        timeline: result.data.timeline ?? [],
        versions: result.data.versions,
      });
    }
  }

  const getQueueEntries = (queue: string) => {
    const queue1 = createQueueFromTimeline(state.shared, {
      trackers,
      includeTimelineIndex: true,
    }).filter((entry) => entry.queue === queue);
    const queue2 = createQueueFromTimeline(
      [...state.posted, ...state.current],
      { trackers, includeTimelineIndex: false }
    ).filter((entry) => entry.queue === queue);
    return [...queue1, ...queue2];
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
    console.log("LISTENERS TRIGGERED", queue, listeners.get(queue)?.size);
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

  const getUpdatedVersion = (queue: string) => {
    return (
      (state.versions[queue] ?? 0) +
      state.shared.filter((el) => el[2] === queue).length
    );
  };

  const createActions = (queue: string) => ({
    getState() {
      return {
        stale: state.stale,
        version: state.versions[queue] ?? 0,
      };
    },
    getMetadata() {
      return {
        user,
        prev: getUpdatedVersion(queue),
        queue,
      };
    },
    get() {
      const entries = getQueueEntries(queue);
      return entries;
    },
    push(transactions: Transaction[]) {
      if (transactions.length) {
        let entry = state.current[state.current.length - 1];
        if (!entry || entry[2] !== queue) {
          const prev = getUpdatedVersion(queue);
          entry = [prev, user, queue];
          state.current.push(entry);
        }
        entry.push(...transactions);
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

  const self = {
    initialize,
    sync,
    save,
    getQueue<TE extends TransactionEntry>(name: string) {
      let current = queues.get(name);
      if (!current) {
        current = createQueue(createActions(name), trackers);
        queues.set(name, current);
      }
      return current as unknown as Queue<TE>;
    },
    registerStaleListener,
    isInactive,
  };

  return self;
}

export type Timeline = ReturnType<typeof createTimeline>;
