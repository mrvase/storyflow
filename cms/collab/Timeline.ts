import { batch } from "@storyflow/state";
import type {
  CollabRef,
  CollabVersion,
  TimelineEntry,
  Transaction,
  TransactionEntry,
  VersionRecord,
} from "./types";
import { Queue, createQueue } from "./Queue";
import { createQueueFromTimeline, filterTimeline, getId, read } from "./utils";
import { clone } from "./clone_debug";

const randomUserId = Math.random().toString(36).slice(2, 10);

const defaultTransform = (pkg: TimelineEntry[]) => pkg;

export function createTimeline(
  options: {
    debugId?: string;
    user?: string;
  } = {}
) {
  const { user = randomUserId, debugId = "" } = options;

  let transform = defaultTransform;

  const state = {
    shared: [] as TimelineEntry[],
    posted: [] as TimelineEntry[],
    // non-transformed ids
    postedIds: [] as string[],
    current: [] as TimelineEntry[],
    versions: null as VersionRecord | CollabVersion | null,
    initialized: false,
    stale: false,
    saving: false,
  };

  const getStatus = () => {
    return {
      isMutated: Boolean(
        state.shared.length + state.posted.length + state.current.length
      ),
    };
  };

  const queues = new Map<string, Queue>();
  const trackers = new WeakMap<Transaction, WeakSet<object>>();

  const listeners = new Map<string, Set<() => void>>();

  let promise: Promise<void> | null = null;
  let prefetched: TimelineEntry[] | boolean = false;

  let savedData: {
    versions: VersionRecord | CollabVersion | null;
    transform?: (entries: TimelineEntry[]) => TimelineEntry[];
  } | null = null;

  function initialize(
    fetch: () => Promise<TimelineEntry[]>,
    data?: {
      versions: VersionRecord | CollabVersion | null;
      transform?: (entries: TimelineEntry[]) => TimelineEntry[];
    },
    options: {
      resetLocalState?: boolean;
      keepListeners?: boolean;
    } = {}
  ) {
    if (state.saving) {
      if (data) {
        // since we now have new data, the queue MUST know to not give a stale queue.
        // so we continue under the assumption of an empty queue. WHen it is done saving,
        // it initializes again with the same data, but the updated queue.
        savedData = data;
        prefetched = [];
      } else {
        return self;
      }
    }

    if (data) {
      transform = data.transform ?? defaultTransform;

      state.versions = data.versions;
      state.initialized = true;
      state.stale = false;
      state.saving = false;

      // REMOVE LISTENERS
      // This ensures that a new queue is not running on stale data
      if (!options.keepListeners) {
        if (data.versions !== null && !Array.isArray(data.versions)) {
          const old = state.versions;
          if (old === null || Array.isArray(old)) {
            throw new Error("Invalid versions");
          }
          Object.entries(data.versions).forEach(([queue, newVersion]) => {
            if (newVersion[0] > (old?.[queue]?.[0] ?? 0)) {
              listeners.get(queue)?.clear();
            }
          });
        } else {
          listeners.forEach((set) => set.clear());
        }
      }

      if (Array.isArray(prefetched)) {
        if (options.resetLocalState) {
          state.current = [];
        }
        console.log("/t", debugId, "INITIALIZED WITH PREFETCHED");
        pull(prefetched);
        triggerListeners();
        prefetched = false;
      } else {
        console.log("/t", debugId, "INITIALIZED WITH FETCH");
        // we also need to ensure that new data is not processed by a stale queue.
        // this is achieved by filtering
        //
        /*
        state.shared = [];
        state.posted = [];
        state.current = [];
        */
      }
    }

    if (!promise && !prefetched) {
      if (!state.initialized) prefetched = true;

      promise = fetch()
        .then((timeline) => {
          if (!timeline.length) return;
          if (state.initialized) {
            pull(timeline);
            triggerListeners();
            prefetched = false;
          } else {
            prefetched = timeline;
          }
        })
        .finally(() => {
          promise = null;
        });
    }

    return self;
  }

  async function softInitializeAsync(
    fetch: () => Promise<TimelineEntry[]>,
    data: {
      versions: VersionRecord | CollabVersion | null;
      transform?: (entries: TimelineEntry[]) => TimelineEntry[];
    }
  ) {
    if (promise) {
      await promise;
      return self;
    } else if (state.initialized) {
      return self;
    }
    initialize(fetch, data);
    if (promise) {
      await promise;
      return self;
    } else {
      return self;
    }
  }

  function post() {
    if (state.posted.length) return;
    state.posted = state.current;
    state.postedIds = state.current.map((el) => getId(el));
    state.current = [];
  }

  function retract() {
    state.current = state.posted.concat(state.current);
    state.posted = [];
    state.postedIds = [];
  }

  function pull(shared: TimelineEntry[]) {
    let posted: TimelineEntry[] = [];

    console.log("/t", debugId, "---STATE BEFORE ", clone(state));

    // is in principle all or nothing
    state.posted.forEach((entry, index) => {
      const id = state.postedIds[index];
      const returned = shared.find((el) => getId(el) === id);
      if (returned) {
        const oldTransactions = read(entry).transactions;
        const newTransactions = read(returned).transactions;
        oldTransactions.forEach((old, index) => {
          const tracker = trackers.get(old);
          if (tracker) {
            trackers.delete(old);
            trackers.set(newTransactions[index], tracker);
          }
        });
      } else {
        posted.push(entry);
      }
    });

    let current = state.current;

    console.log(
      "/t",
      debugId,
      "---PACKAGES BEFORE FILTER",
      clone({ shared, posted, current })
    );

    [shared, posted, current] = filterTimeline(
      [shared, posted, current],
      state.versions
    );

    current = current.filter((el) => el.length > 3); // if transactions have been removed, we can remove the entry entirely

    console.log(
      "/t",
      debugId,
      "---PACKAGES AFTER FILTER",
      clone({ shared, posted, current })
    );

    const transformed = transform([...shared, ...posted, ...current]);

    const transformedCurrent = transformed.splice(
      shared.length + posted.length,
      current.length
    );

    const transformedPosted = transformed.splice(shared.length, posted.length);

    console.log("/t", debugId, "---NEW ", {
      shared: clone(transformed),
      posted: clone(transformedPosted),
      current: clone(transformedCurrent),
    });

    state.shared = transformed;
    state.posted = transformedPosted;
    state.current = transformedCurrent;

    mutationListeners.trigger(getStatus().isMutated);
  }

  type SyncPromise = Promise<"success" | "stale" | "error">;

  let syncPromise: SyncPromise | null = null;

  async function sync(
    callback: (
      upload: TimelineEntry[],
      state: { startId: string | null; length: number }
    ) => Promise<
      | { status: "success" | "stale"; updates: TimelineEntry[] }
      | { status: "error" }
    >
  ) {
    if (syncPromise) {
      return await syncPromise;
    }

    const size = listenersSize();

    if (
      // should either have something for the server or someone to listen to the server
      !(size > 0 || state.current.length > 0) ||
      state.saving ||
      state.posted.length > 0 ||
      state.stale
    ) {
      return;
    }

    post();

    // console.log("SYNC", clone(state));

    syncPromise = callback(state.posted, {
      startId: getId(state.shared[0]),
      length: state.shared.length,
    }).then((result) => {
      syncPromise = null;
      if (state.saving || result.status === "error") {
        console.warn("/t", debugId, "RETRACT");
        retract();

        return "error";
      } else if (result.status === "stale") {
        console.warn(
          "/t",
          debugId,
          "STALE",
          getId(state.shared[0]),
          result.updates
        );

        retract();

        prefetched = result.updates;
        state.stale = true;
        staleListeners.trigger(result.updates);

        // if staleListener reinitializes, nothing should happen here
        if (state.stale !== true) return "success";

        state.current = state.posted;
        state.posted = [];

        return "stale";
      } else if (result.updates.length) {
        pull([...state.shared, ...result.updates]);
        new Set(result.updates.map((el) => read(el).queue)).forEach((queue) => {
          triggerListeners(queue);
        });
      }
      return "success";
    });

    return await syncPromise;
  }

  async function save(
    callback: (
      upload: TimelineEntry[]
    ) => Promise<
      { status: "error" } | { status: "success"; updated: TimelineEntry[] }
    >
  ) {
    state.saving = true;

    // sync

    if (state.posted.length || state.current.length) {
      return false;
    }

    const promise = callback(state.shared);

    const result = await promise;

    state.saving = false;
    if (result.status === "success") {
      if (savedData) {
        console.log("/t", debugId, "WITH SAVED DATA", savedData);
        prefetched = result.updated;
        initialize(
          () => new Promise(() => []), // uses prefetched
          savedData
        );
        savedData = null;
      } else {
        prefetched = result.updated;
        state.stale = true;
        staleListeners.trigger(prefetched);
      }
      return true;
    } else {
      return false;
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

  function triggerListeners(queue?: string) {
    console.log("/t", debugId, "LISTENERS TRIGGERED", queue);
    batch(() => {
      if (!queue) {
        listeners.forEach((set) => set.forEach((listener) => listener()));
      } else {
        listeners.get(queue)?.forEach((listener) => listener());
      }
      mutationListeners.trigger(getStatus().isMutated);
    });
  }

  const createListenersSet = <T>() => {
    const set = new Set<(data: T) => void>();
    return {
      register(listener: (data: T) => void) {
        set.add(listener);
        return () => {
          set.delete(listener);
        };
      },
      trigger(data: T) {
        set.forEach((listener) => listener(data));
      },
    };
  };

  const staleListeners = createListenersSet<TimelineEntry[]>();
  const mutationListeners = createListenersSet<boolean>();

  const getQueueVersion = (queue: string) => {
    return Array.isArray(state.versions)
      ? state.versions?.[0]
      : state.versions?.[queue]?.[0] ?? 0;
  };

  const getPreviousId = (queue: string): CollabRef => {
    const prevShared = state.shared.filter((el) => read(el).queue === queue);
    /*
    const prev = prevShared[prevShared.length - 1];
    const prevUser = prev ? read(prev).user : "";
    */
    const version = getQueueVersion(queue) + prevShared.length;
    return version;
  };

  const createActions = (queue: string) => ({
    getMetadata() {
      return {
        user,
        prev: getPreviousId(queue),
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
        if (!entry || read(entry).queue !== queue) {
          const prev = getPreviousId(queue);
          entry = [queue, prev, user];
          state.current.push(entry);
        }
        entry.push(...transactions);
      }
      // push is used to trigger also when there are no transactions
      triggerListeners(queue);
    },
    registerListener(listener: () => void) {
      return registerListener(queue, listener);
    },
  });

  function listenersSize() {
    let size = 0;
    listeners.forEach((set) => (size += set.size));
    return size;
  }

  function isInactive() {
    const size = listenersSize();
    return (
      size === 0 && state.posted.length === 0 && state.current.length === 0
    );
  }

  const self = {
    initialize,
    softInitializeAsync,
    sync,
    save,
    getQueue<TE extends TransactionEntry>(name: string = "") {
      let current = queues.get(name);
      if (!current) {
        current = createQueue(createActions(name), trackers);
        queues.set(name, current);
      }
      return current as unknown as Queue<TE>;
    },
    getStatus,
    registerStaleListener: staleListeners.register,
    registerMutationListener: mutationListeners.register,
    isInactive,
  };

  return self;
}

export type Timeline = ReturnType<typeof createTimeline>;
