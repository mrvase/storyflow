import { QueueEntry, Transaction, TransactionEntry } from "./types";

export type QueueListenerParam<TE extends TransactionEntry> = {
  forEach: (callback: (entry: QueueEntry<TE>) => void) => void;
  version: number | null;
  stale: boolean;
};

export type QueueListener<TE extends TransactionEntry> = (
  param: QueueListenerParam<TE>
) => void;

export type PushFunction<TE extends TransactionEntry> = (
  latest: Transaction<TE> | undefined
) => {
  push?: Transaction<TE>[];
  await?: Transaction<TE>;
};

export function createQueue<TE extends TransactionEntry>(
  actions: {
    getState: () => {
      version: number;
      stale: boolean;
    };
    getMetadata: () => {
      prev: number;
      user: string;
      queue: string;
    };
    get: () => QueueEntry<TE>[];
    push: (transactions: Transaction<TE>[]) => void;
    registerListener: (listener: () => void) => () => void;
  },
  trackMap: WeakMap<Transaction, WeakSet<object>>
) {
  let latest = {
    transaction: undefined as Transaction<TE> | undefined,
  };

  function addToTrackMap(transaction: Transaction<TE>, tracker?: object) {
    if (!trackMap.has(transaction)) {
      trackMap.set(transaction, new WeakSet(tracker ? [tracker] : undefined));
    } else if (tracker) {
      trackMap.get(transaction)?.add(tracker);
    }
  }

  const push = (
    payload: Transaction<TE> | PushFunction<TE>,
    tracker?: object
  ) => {
    let transactions: Transaction<TE>[] = [];

    if (typeof payload === "function") {
      transactions = merge(payload as PushFunction<TE>, tracker);
    } else {
      transactions = [payload];
    }

    if (transactions.length === 0) {
      // push to trigger listeners
      actions.push(transactions);
      return false;
    }

    transactions.forEach((transaction) => {
      addToTrackMap(transaction, tracker);
    });

    actions.push(transactions);

    return true;
  };

  function merge(
    callback: PushFunction<TE>,
    tracker?: object
  ): Transaction<TE>[] {
    const payload = callback(latest.transaction);
    if (payload.await) {
      latest.transaction = payload.await;
      addToTrackMap(payload.await, tracker);
    } else {
      // should not delete trackers since the operation might have been pushed.
      latest.transaction = undefined;
    }
    return payload.push ?? [];
  }

  const forEach = (callback: (entry: QueueEntry<TE>) => void) => {
    const queue = actions.get();
    if (latest.transaction) {
      queue.push({
        ...actions.getMetadata(),
        transaction: latest.transaction,
        transactionIndex: null,
        timelineIndex: null,
        trackers: trackMap.get(latest.transaction),
      });
    }
    queue.forEach((entry) => {
      callback(entry);
    });
  };

  function register(listener: QueueListener<TE>) {
    const runningListener = () => {
      listener({
        forEach,
        ...actions.getState(),
      });
    };
    listener({
      forEach,
      ...actions.getState(),
    });
    return actions.registerListener(runningListener);
  }

  return {
    push,
    forEach,
    register,
  };
}
export type Queue<TE extends TransactionEntry = TransactionEntry> = ReturnType<
  typeof createQueue<TE>
>;
