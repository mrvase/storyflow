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

export type QueueListenerParam<Operation extends DefaultOperation> = {
  forEach: QueueForEach<Operation>;
  trackedForEach: QueueForEach<Operation>;
  version: number | null;
  origin: "push" | "pull" | "initial";
  stale: boolean;
};

export type QueueListener<Operation extends DefaultOperation> = (
  param: QueueListenerParam<Operation>
) => void;

export type QueueTransformStrategy<Operation extends DefaultOperation> = (
  packages: ServerPackage<Operation>[]
) => ServerPackage<Operation>[];

export interface Queue<Operation extends DefaultOperation> {
  key: string;
  clientId: string | number | null;
  push: (
    action:
      | Operation
      | ((latest: Operation | undefined, noop: Operation) => Operation[]),
    tracker?: QueueTracker<Operation>
  ) => boolean;
  register: (
    listener: QueueListener<Operation>,
    tracker?: QueueTracker<Operation>
  ) => () => void;
  run: (listener: QueueListener<Operation>) => this;
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
  mergeableNoop: Operation | undefined;
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
    mergeableNoop?: Operation;
    transform?: QueueTransformStrategy<Operation>;
    clientId?: string | number | null;
  } = {}
): Queue<Operation> {
  const debug = createChangeDebugger();

  const {
    mergeableNoop,
    transform = (x) => x,
    clientId = randomClientId,
  } = options;

  const state = {
    shared: [] as ServerPackage<Operation>[],
    posted: [] as Operation[],
    queue: [] as Operation[],
    version: 0 as number,
    initialized: false,
    stale: false,
  };

  const getIndex = () => state.version + state.shared.length;

  /*
  we use an "initialize" method, because it allows us to
  re-initialize later, while keeping the subscribed listeners
  */
  function initialize(
    initialVersion: number,
    initialHistory: ServerPackage<Operation>[]
  ) {
    if (!state.initialized || initialVersion > state.version) {
      const initialShared = filterServerPackages(
        initialVersion,
        initialHistory
      );
      state.shared = transform(initialShared);
      state.posted = [];
      state.queue = [];
      state.version = initialVersion;
      state.initialized = true;
      state.stale = false;
    }
    return queue;
  }

  // const timer = createTimer();

  function _post(force = false) {
    if (!state.queue.length) return;

    const last = state.queue[state.queue.length - 1];
    const lastIsNoop = last && last === mergeableNoop;

    if (mergeableNoop && (!force || lastIsNoop)) {
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
    operation:
      | Operation
      | ((latest: Operation | undefined, noop: Operation) => Operation[]),
    tracker?: QueueTracker<Operation>
  ) {
    if (!state.initialized) {
      throw new Error("Queue has not been initialized");
    }
    if (state.stale) {
      console.error("Queue is stale");
      return false;
    }

    let operations: Operation[] = [];

    if (typeof operation === "function") {
      operations = merge(
        operation as (
          latest: Operation | undefined,
          noop: Operation
        ) => Operation[]
      );
    } else {
      operations = [operation];
    }

    if (operations.length === 0) {
      console.log("EMPTY PUSH");
      return false;
    }

    state.queue.push(...operations);
    tracker?.push(...operations);

    console.log("PUSH", operations, state.shared, state.queue);

    _triggerListeners({ origin: "push" });
    return true;
  }

  function merge(
    callback: (latest: Operation | undefined, noop: Operation) => Operation[]
  ): Operation[] {
    const queue = state.queue;

    const [latest] = queue.splice(queue.length - 1, 1);
    const operations = callback(latest, mergeableNoop ?? ({} as Operation));

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
    listeners.set(listener, tracker);
    run(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function run(
    listener: QueueListener<Operation>,
    origin?: "push" | "pull" | "initial",
    tracker_?: QueueTracker<Operation>
  ) {
    const tracker = tracker_ ?? listeners.get(listener)!;
    listener({
      forEach,
      trackedForEach: tracker ? tracker.trackForEach(forEach) : forEach,
      version: state.version,
      origin: origin ?? "pull",
      stale: state.stale,
    });
    return queue;
  }

  const getPackageId = (pkg: ServerPackage<Operation> | undefined) => {
    if (!pkg) return null;
    const unwrapped = unwrapServerPackage(pkg);
    return `${unwrapped.key}:${unwrapped.clientId}:${unwrapped.index}`;
  };

  function _pull(packages: ServerPackage<Operation>[]) {
    const sharedLength = state.shared.length;
    const firstPackageId = getPackageId(state.shared[0]);

    debug("PULL", key, packages.length, sharedLength);

    /*
    we force a version change
    */
    if (firstPackageId && firstPackageId !== getPackageId(packages[0])) {
      console.warn("SETTING TO STALE", {
        firstPackageId,
        shared: state.shared,
        packages,
        firstPackage: [...(state.shared[0] ?? [])],
      });
      state.stale = true;
      _triggerListeners({ origin: "pull" });
      return;
    }

    if (packages.length === sharedLength && sharedLength > 0) {
      // No changes - but should at least have the new posted package.
      // So we do nothing until the next pull.
      return;
    }

    const index = getIndex();

    /*
    the posted ones are still in state.posted, so
    they are also still in the WeakSet
    */

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

    if (state.posted.length > 0 || !state.initialized || state.stale) {
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
      listeners.forEach((tracker, listener) => run(listener, origin, tracker));
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
    queueForEach(state, callback, {
      ...options,
      clientId,
      key,
      index: getIndex(),
    });
  }
  /*
  function forEach(
    ...[callback, options = {}]: Parameters<QueueForEach<Operation>>
  ) {
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
  */

  const queue = {
    key,
    clientId,
    sync,
    push,
    register,
    run,
    isInactive,
    forEach,
    initialize,
    mergeableNoop: options.mergeableNoop,
  };

  return queue;
}

export function queueForEach<Operation extends DefaultOperation>(
  state:
    | ServerPackage<Operation>[]
    | {
        shared: ServerPackage<Operation>[];
        posted: Operation[];
        queue: Operation[];
      },
  callback: (element: WithMetaData<Operation>, index: number) => true | void,
  options: {
    clientId: string | number | null;
    key: string;
    index: number;
    reverse?: boolean;
  }
) {
  const { reverse, ...rest } = options;
  const defaultMetadata = { ...rest, serverPackageIndex: null };

  /** BREAKABLE forEach loop */

  const reversibleForEach = <T>(
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

  const callForEach = (
    array: Operation[],
    metadata: {
      clientId: string | number | null;
      key: string;
      index: number;
      serverPackageIndex: number | null;
    } = defaultMetadata
  ) => {
    return reversibleForEach(array, (operation, operationIndex) => {
      callback(
        {
          operation,
          operationIndex,
          ...metadata,
        },
        i++
      );
    });
  };

  const sharedForEach = (shared: ServerPackage<Operation>[]) => {
    return reversibleForEach(shared, (pkg, serverPackageIndex) => {
      const { operations, ...rest } = unwrapServerPackage(pkg);
      return callForEach(operations, {
        ...rest,
        serverPackageIndex,
      });
    });
  };

  if (Array.isArray(state)) {
    sharedForEach(state);
  } else if (options.reverse) {
    if (callForEach(state.queue)) return;
    if (callForEach(state.posted)) return;
    if (sharedForEach(state.shared)) return;
  } else {
    if (sharedForEach(state.shared)) return;
    if (callForEach(state.posted)) return;
    if (callForEach(state.queue)) return;
  }
}
