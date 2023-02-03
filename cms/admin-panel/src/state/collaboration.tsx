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
import { useSubject } from "./useSubject";

export type QueueOptions<Operation extends DefaultOperation> = {
  transform: QueueTransformStrategy<Operation>;
  invert?: QueueInvertStrategy<Operation>;
  mergeableNoop?: Operation;
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

  const duration = 3500;

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

  const mutate = <Operation extends AnyOp>(
    document: string, // article
    key: string, // article (templates / labels) // field name (text / component),
    tracker?: QueueTracker<Operation>
  ): {
    push: (action: Operation) => void;
    mergeablePush: (
      action:
        | Operation
        | ((prev: Operation | undefined, noop: Operation) => Operation[])
    ) => void;
    undo: (state: any) => void;
    redo: (state: any) => void;
  } => {
    return {
      push(op) {
        const queue = queues.get<Operation>(document, key)!;
        let changed = false;
        if (queue.mergeableNoop) {
          // make sure to always have mergeableNoop at the end with normal push
          changed = queue.push((prev, noop) => {
            if (!prev || prev === noop) return [op, noop];
            return [prev, op, noop];
          }, tracker);
        } else {
          changed = queue.push(op, tracker);
        }
        if (changed) emitMutation(document);
      },
      mergeablePush(op) {
        const queue = queues.get<Operation>(document, key)!;
        const changed = queue.push(op, tracker);
        if (changed) emitMutation(document);
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
    strategy: QueueOptions<Operation>
  ) => {
    const queue = withUndoRedo(
      createQueue(key, {
        mergeableNoop: strategy.mergeableNoop,
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
    strategy: QueueOptions<Operation>
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
