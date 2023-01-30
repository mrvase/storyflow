import { batch } from "../state/State";
import { createChangeDebugger } from "./debug";
import { DefaultOperation, ServerPackage, WithMetaData } from "./types";
import {
  createServerPackage,
  filterServerPackages,
  unwrapServerPackage,
} from "./utils";

const randomClientId = Math.random().toString(36).slice(2, 10);

type QueueForEach<Operation extends DefaultOperation> = (
  callback: (element: WithMetaData<Operation>, index: number) => true | void,
  options?: {
    reverse?: boolean;
  }
) => void;

export type QueueListener<Operation extends DefaultOperation> = (props: {
  forEach: QueueForEach<Operation>;
  trackedForEach: QueueForEach<Operation>;
  version: number | null;
  origin: "push" | "pull" | "initial";
  primary: boolean;
}) => void;

export type QueueTransformStrategy<Operation extends DefaultOperation> = (
  packages: ServerPackage<Operation>[]
) => ServerPackage<Operation>[];

export interface Queue<Operation extends DefaultOperation> {
  key: string;
  clientId: string | number | null;
  push: (
    action: Operation | ((latest: Operation | undefined) => Operation[]),
    tracker?: QueueTracker<Operation>
  ) => boolean;
  register: (
    listener: QueueListener<Operation>,
    tracker?: QueueTracker<Operation>
  ) => () => void;
  sync: (
    callback: (
      pkg: ServerPackage<Operation>
    ) => Promise<ServerPackage<Operation>[] | false>,
    options?: {
      force?: boolean;
    }
  ) => void;
  isInactive: () => boolean;
  forEach: QueueForEach<Operation>;
  initialize: (
    initialVersion: number,
    initialHistory: ServerPackage<Operation>[]
  ) => this;
}

export function createQueueTracker<Operation extends DefaultOperation>() {
  const handled = {
    shared: -1,
    queue: new WeakSet<Operation>(),
  };

  return {
    trackForEach(forEach: QueueForEach<Operation>): QueueForEach<Operation> {
      return (callback, options) => {
        let newIndex = handled.shared;
        forEach((element, index) => {
          const { operation, serverPackageIndex } = element;
          if (
            serverPackageIndex !== null &&
            serverPackageIndex <= handled.shared
          ) {
            return;
          }
          newIndex = Math.max(newIndex, serverPackageIndex ?? -1);
          if (handled.queue.has(operation)) {
            return;
          }
          handled.queue.add(operation);
          callback(element, index);
        }, options);
        handled.shared = newIndex;
      };
    },
    push(...ops: Operation[]) {
      ops.forEach((op) => handled.queue.add(op));
    },
    replace(ops: Map<Operation, Operation>) {
      ops.forEach((newOp, oldOp) => {
        if (handled.queue.has(oldOp)) {
          // handled.queue.delete(oldOp);
          handled.queue.add(newOp);
        }
      });
    },
  };
}

export type QueueTracker<Operation extends DefaultOperation> = ReturnType<
  typeof createQueueTracker<Operation>
>;

export function createQueue<Operation extends DefaultOperation>(
  key: string,
  options: {
    mergeable?: number;
    transform?: QueueTransformStrategy<Operation>;
    clientId?: string | number | null;
  } = {}
): Queue<Operation> {
  const debug = createChangeDebugger();

  const transform = options.transform ?? ((x) => x);

  const state = {
    shared: transform([]),
    posted: [] as Operation[],
    queue: [] as Operation[],
    version: 0 as number,
    initialized: false,
    // mergeIndex: 0
  };

  const getIndex = () => state.version + state.shared.length;

  function initialize(
    initialVersion: number,
    initialHistory: ServerPackage<Operation>[]
  ) {
    const initialShared = filterServerPackages(initialVersion, initialHistory);
    state.shared = transform(initialShared);
    state.posted = [];
    state.queue = [];
    state.version = initialVersion;
    state.initialized = true;
    console.log("INITIALIZED", key, state);
    return queue;
  }

  // const timer = createTimer();

  const clientId =
    options.clientId !== undefined ? options.clientId : randomClientId;

  function _post(force = false) {
    if (!state.queue.length) return;

    const mergeable = options.mergeable; // && timer.getDelta() < options.mergeable;

    console.log("POSTING", mergeable);

    if (mergeable && !force) {
      state.posted = state.queue.slice(0, -1);
      state.queue = state.queue.slice(-1);
    } else {
      state.posted = state.queue;
      state.queue = [];
    }
  }

  function _retract() {
    state.queue = state.posted.concat(state.queue);
    state.posted = [];
  }

  function push(
    operation: Operation | ((latest: Operation | undefined) => Operation[]),
    tracker?: QueueTracker<Operation>
  ) {
    if (!state.initialized) {
      throw new Error("Queue has not been initialized");
    }

    let operations: Operation[] = [];

    if (typeof operation === "function") {
      operations = merge(operation);
    } else {
      operations = [operation];
    }

    if (operations.length === 0) {
      return false;
    }

    state.queue.push(...operations);
    tracker?.push(...operations);

    // timer.trigger();
    _triggerListeners({ origin: "push" });
    return true;
  }

  function merge(
    callback: (latest: Operation | undefined) => Operation[]
  ): Operation[] {
    const queue = state.queue;

    const [latest] = queue.splice(queue.length - 1, 1);
    const operations = callback(latest);

    if (operations.length === 1 && operations[0] === latest) {
      queue.push(...operations);
      return [];
    }

    // state.mergeIndex += 2 - operations.length;
    return operations;
  }

  const listeners = new Map<
    QueueListener<Operation>,
    QueueTracker<Operation>
  >();

  function register(
    listener: QueueListener<Operation>,
    trackerArg?: QueueTracker<Operation>
  ) {
    const tracker = trackerArg ?? createQueueTracker();
    listener({
      forEach: forEach,
      trackedForEach: tracker.trackForEach(forEach),
      version: state.version,
      origin: "pull",
      primary: listeners.size === 0,
    });
    listeners.set(listener, tracker);
    return () => {
      listeners.delete(listener);
    };
  }

  function _pull(packages: ServerPackage<Operation>[]) {
    const sharedLength = state.shared.length;

    debug("PULL", key, packages.length, sharedLength);

    if (packages.length === sharedLength && sharedLength > 0) {
      // no changes
      return;
    }

    const index = getIndex();

    /*
    the posted ones are still in state.posted, so
    they are also still in the WeakSet
    */

    console.log("PULL SERVER PACKAGE", packages);

    const postedPackage = packages.find((_pkg) => {
      const pkg = unwrapServerPackage(_pkg);
      return (
        pkg.key === key &&
        pkg.clientId === clientId &&
        // TODO jeg antager vel her, at det er min pakke, der er kommet på som den næste?
        // skal jeg ikke først filtrere min shared og modtaget shared til kun at inkludere egne packages
        // og så sammenligne min shared index + 1 med modtaget shared index.
        pkg.index === index
      );
    });

    if (postedPackage) {
      console.log("FOUND POSTED PACKAGE", postedPackage);
      const postedOperations = unwrapServerPackage(postedPackage).operations;
      const map = new Map(
        state.posted.map((oldOp, index) => [oldOp, postedOperations[index]])
      );
      listeners.forEach((tracker) => tracker.replace(map));
    }

    const newShared = transform(
      packages.concat([
        createServerPackage({
          key,
          clientId,
          index,
          operations: state.queue,
        }),
      ])
    );

    const [newQueue] = newShared.splice(newShared.length - 1, 1);

    state.shared = newShared;
    state.posted = [];
    state.queue = unwrapServerPackage(newQueue).operations;
    // state.mergeIndex = 0;

    _triggerListeners({ origin: "pull" });
  }

  async function sync(
    callback: (
      pkg: ServerPackage<Operation>
    ) => Promise<ServerPackage<Operation>[] | false>,
    options: {
      force?: boolean;
    } = {}
  ) {
    debug("SYNC - SHARED:", key, state.shared.length);
    debug("SYNC - POSTED:", key, state.posted.length);
    debug("SYNC - QUEUE:", key, state.queue.length);

    if (state.posted.length > 0 || !state.initialized) {
      // is already posting
      return;
    }

    _post(options.force);

    const newServerPackage = createServerPackage({
      key,
      clientId,
      index: getIndex(),
      operations: state.posted,
    });

    const result = await callback(newServerPackage);

    if (result === false) {
      console.log("RETRACT", key);
      _retract();
    } else {
      const packages = filterServerPackages(state.version ?? 0, result);
      _pull(packages);
    }
  }

  function _triggerListeners({
    origin,
  }: {
    origin: "push" | "pull" | "initial";
  }) {
    batch(() => {
      let index = 0;
      listeners.forEach((tracker, listener) => {
        listener({
          forEach,
          trackedForEach: tracker.trackForEach(forEach),
          version: state.version,
          origin,
          primary: !index++,
        });
      });
    });
  }

  function isInactive() {
    return (
      listeners.size === 0 &&
      state.posted.length === 0 &&
      state.queue.length === 0
    );
  }

  function forEach(
    ...[callback, options = {}]: Parameters<QueueForEach<Operation>>
  ) {
    /** BREAKABLE forEach loop */

    const _forEach = <T>(
      arr: T[],
      callback: (value: T, index: number) => any
    ) => {
      let i = options.reverse ? arr.length - 1 : 0;
      let increment = () => (options.reverse ? i-- : i++);
      let condition = () => (options.reverse ? i >= 0 : i < arr.length);
      let done: true | undefined;
      while (condition()) {
        if (callback(arr[i], options.reverse ? arr.length - 1 - i : i)) {
          done = true;
          break;
        }
        increment();
      }
      return done;
    };

    let i = 0;

    const sharedForEach = () => {
      return _forEach(state.shared, (pkg, serverPackageIndex) => {
        const { clientId, key, index, operations } = unwrapServerPackage(pkg);
        return _forEach(operations, (operation, operationIndex) => {
          callback(
            {
              operation,
              clientId,
              key,
              index,
              operationIndex,
              serverPackageIndex,
            },
            i++
          );
        });
      });
    };

    const postedForEach = () => {
      return _forEach(state.posted, (operation, operationIndex) => {
        callback(
          {
            operation,
            clientId,
            key,
            index: getIndex(),
            operationIndex,
            serverPackageIndex: null,
          },
          i++
        );
      });
    };

    const queueForEach = () => {
      return _forEach(state.queue, (operation, operationIndex) => {
        callback(
          {
            operation,
            clientId,
            key,
            index: getIndex(),
            operationIndex: state.posted.length + operationIndex,
            serverPackageIndex: null,
          },
          i++
        );
      });
    };

    if (options.reverse) {
      if (queueForEach()) return;
      if (postedForEach()) return;
      if (sharedForEach()) return;
    } else {
      if (sharedForEach()) return;
      if (postedForEach()) return;
      if (queueForEach()) return;
    }
  }

  const queue = {
    key,
    clientId,
    sync,
    push,
    register,
    isInactive,
    forEach,
    initialize,
  };

  return queue;
}
