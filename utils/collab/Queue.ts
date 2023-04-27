import { QueueEntry, Transaction, TransactionEntry } from "./types";

export type QueueListener<TE extends TransactionEntry> = (param: {
  forEach: (callback: (entry: QueueEntry<TE>) => void) => void;
  version: number | null;
  stale: boolean;
}) => void;

export function createQueue<TE extends TransactionEntry>(actions: {
  getState: () => {
    version: number;
    stale: boolean;
  };
  get: () => QueueEntry<TE>[];
  push: (transactions: Transaction<TE>[], tracker?: object) => void;
  registerListener: (listener: () => void) => () => void;
}) {
  let timeline = actions.get();
  let latest: Transaction<TE> | undefined;

  const push = (
    payload:
      | Transaction<TE>
      | ((latest: Transaction<TE> | undefined) => Transaction<TE>[]),
    tracker?: object
  ) => {
    let transactions: Transaction<TE>[] = [];

    if (typeof payload === "function") {
      transactions = merge(
        payload as (latest: Transaction<TE> | undefined) => Transaction<TE>[]
      );
    } else {
      transactions = [payload];
    }

    if (transactions.length === 0) {
      console.log("EMPTY PUSH");
      return false;
    }

    actions.push(transactions, tracker);

    return true;
  };

  function merge(
    callback: (latest: Transaction<TE> | undefined) => Transaction<TE>[]
  ): Transaction<TE>[] {
    const transactions = callback(latest);
    [latest] = transactions.splice(transactions.length - 1, 1);
    return transactions;
  }

  const forEach = (callback: (entry: QueueEntry<TE>) => void) => {
    timeline.forEach((entry) => {
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

  const queue = {
    push,
    forEach,
    register,
  };

  return queue;
}
export type Queue<TE extends TransactionEntry = TransactionEntry> = ReturnType<
  typeof createQueue<TE>
>;
