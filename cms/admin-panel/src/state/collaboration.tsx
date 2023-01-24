import React from "react";
import {
  createQueueMap,
  onInterval,
  Queue,
  syncQueueMap,
  WithUndoRedo,
  withUndoRedo,
  createQueue,
  createQueueTracker,
  QueueTracker,
  QueueListener,
  DefaultOperation,
  QueueTransformStrategy,
  QueueInvertStrategy,
} from "@storyflow/state";
import { AnyOp } from "shared/operations";
import { clone } from "../utils/clone";
import { useContextWithError } from "../utils/contextError";
import { useClient } from "../client";

export type QueueStrategy<Operation extends DefaultOperation> = {
  transform: QueueTransformStrategy<Operation>;
  invert?: QueueInvertStrategy<Operation>;
  mergeable?: number;
};

export const CollabContext = React.createContext<ReturnType<
  typeof createDocumentCollaboration
> | null>(null);

export const useCollab = () => useContextWithError(CollabContext, "Collab");

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const client = useClient();

  const collab = React.useMemo(() => {
    return createDocumentCollaboration(client.articles.fields.mutation);
  }, [client]);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, []);

  return (
    <CollabContext.Provider value={collab}>{children}</CollabContext.Provider>
  );
}

function useSubject<Payload>(initialState: Payload) {
  const subs = new Set<(payload: Payload) => void>();
  const register = (callback: (payload: Payload) => void) => {
    subs.add(callback);
    return () => {
      subs.delete(callback);
    };
  };

  let snapshot = initialState;

  const notify = (payload: Payload) => {
    snapshot = payload;
    subs.forEach((f) => f(payload));
  };

  return [register, notify, snapshot] as [
    typeof register,
    typeof notify,
    Payload
  ];
}

function createDocumentCollaboration(
  mutation: Parameters<typeof syncQueueMap<AnyOp>>[1]
) {
  const queues = createQueueMap<AnyOp, WithUndoRedo<Queue<AnyOp>>>();

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
    const result = await syncQueueMap(queues, mutation, { force });
    queues.purge();
    emitEvent("done");
    return result;
  };

  const duration = 5000;

  const syncOnInterval = () => {
    return onInterval(
      (event) => throttle(() => sync(event === "unload"), duration / 2),
      { duration }
    );
  };

  const mutate = <Operation extends AnyOp>(
    document: string, // article
    key: string, // article (templates / labels) // field name (text / component),
    tracker?: QueueTracker<Operation>
  ): {
    push: (
      action: Operation | ((prev: Operation | undefined) => Operation[]),
      noTracking?: boolean
    ) => void;
    undo: (state: any) => void;
    redo: (state: any) => void;
  } => {
    return {
      push(op, noTracking) {
        emitMutation(document);
        const queue = queues.get<Operation>(document, key)!;
        if (noTracking) {
          console.log("NO TRACKER");
          queue.push(op);
        } else {
          queue.push(op, tracker);
        }
      },
      undo(state) {
        emitMutation(document);
        const queue = queues.get(document, key);
        queue?.undo(state);
      },
      redo(state) {
        emitMutation(document);
        const queue = queues.get(document, key);
        queue?.redo(state);
      },
    };
  };

  const boundMutate = <Operation extends AnyOp>(
    document: string, // article
    key: string // article (templates / labels) // field name (text / component),
  ) => {
    const tracker = createQueueTracker<Operation>();
    const mutator = mutate<Operation>(document, key, tracker);
    return {
      ...mutator,
      register(listener: QueueListener<Operation>) {
        const queue = queues.get<Operation>(document, key)!;
        return queue?.register(listener, tracker);
      },
    };
  };

  const addQueue = <Operation extends AnyOp>(
    document: string,
    key: string,
    strategy: QueueStrategy<Operation>
  ) => {
    const queue = withUndoRedo(
      createQueue(key, {
        mergeable: strategy.mergeable,
        transform: strategy.transform,
      }),
      strategy.invert
    );
    queues.set(document, key, queue as any);
    return queue;
  };

  const getOrAddQueue = <Operation extends AnyOp>(
    document: string,
    key: string,
    strategy: QueueStrategy<Operation>
  ) => {
    const current = queues.get(document, key);
    if (current) return current as any as WithUndoRedo<Queue<Operation>>;
    return addQueue(document, key, strategy);
  };

  return {
    sync,
    syncOnInterval,
    mutate,
    boundMutate,
    getQueue: queues.get,
    getOrAddQueue,
    registerEventListener,
    registerMutationListener,
  };
}

export function createQueueCache<T>(initialValue: T) {
  // if not cloned, we will mutate the initialValue
  // which will give problems with double render.
  let cached = clone(initialValue);
  let index = -1;
  return function cache<Operation extends DefaultOperation>(
    forEach: Queue<Operation>["forEach"],
    callback: (
      prev: T,
      ...args: Parameters<Parameters<Queue<Operation>["forEach"]>[0]>
    ) => T
  ) {
    let saved = false;
    let current = cached;
    let newIndex = index;
    forEach((...args) => {
      const serverPackageIndex = args[0].serverPackageIndex;
      if (serverPackageIndex === null) {
        if (!saved) {
          saved = true;
          cached = clone(current);
        }
      } else if (serverPackageIndex <= index) {
        return;
      } else {
        newIndex = Math.max(newIndex, serverPackageIndex);
      }
      current = callback(current, ...args);
    });
    if (!saved) {
      // if there has not yet been any local-only operations
      cached = clone(current);
    }
    index = newIndex;
    return current;
  };
}
