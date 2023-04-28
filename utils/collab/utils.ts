import {
  TimelineEntry,
  QueueEntry,
  TransactionEntry,
  Transaction,
  SpliceOperation,
  ToggleOperation,
} from "./types";

export const getId = (pkg: TimelineEntry | undefined) => {
  return pkg ? pkg.slice(0, 3).join("-") : null;
};

export const getTransactionId = (t: QueueEntry) => {
  if (t.transactionIndex === null) {
    // if it is waiting to be merged
    return null;
  }
  return `${t.timelineIndex ?? ""}${t.prev}${t.queue}${t.transactionIndex}`;
};

export const createQueueFromTimeline = <
  TE extends TransactionEntry = TransactionEntry
>(
  entries: TimelineEntry[],
  options: {
    includeTimelineIndex?: boolean;
    trackers?: WeakMap<Transaction, WeakSet<object>>;
  } = {}
): QueueEntry<TE>[] => {
  const queueEntries: QueueEntry<TE>[] = [];

  entries.forEach((el: TimelineEntry, timelineIndex: number) => {
    const metadata = {
      prev: el[0],
      user: el[1],
      queue: el[2],
      timelineIndex: options.includeTimelineIndex ? timelineIndex : null,
    };
    const [, , , ...transactions] = el;

    transactions.forEach((transaction, transactionIndex) => {
      queueEntries.push({
        ...metadata,
        transactionIndex,
        transaction: transaction as Transaction<TE>,
        trackers: options.trackers?.get(transaction),
      });
    });
  });

  return queueEntries;
};

export function filterTimeline(
  pkgs: TimelineEntry[],
  versions: Record<string, number>
) {
  const found = new Set<string>();
  return pkgs.filter((el) => {
    const index = el[0];
    const queue = el[2];
    const version = versions[queue] ?? 0;
    if (index === version) {
      found.add(queue);
    }
    return found.has(queue) && index >= version;
  });
}

export const isSpliceOperation = (
  action: unknown
): action is SpliceOperation<any> => {
  return (
    Array.isArray(action) &&
    typeof action[0] === "number" &&
    (action.length === 1 || typeof action[1] === "number")
  );
};

export const isToggleOperation = (
  action: unknown
): action is ToggleOperation<string, any> => {
  return (
    Array.isArray(action) &&
    action.length === 2 &&
    typeof action[1] === "string"
  );
};

type InferSplice<TE, K extends string | undefined> = K extends string
  ? Extract<TE, TransactionEntry<K, SpliceOperation>>[1][number]
  : never;

type InferToggle<TE, K extends string | undefined> = K extends string
  ? Extract<TE, TransactionEntry<K, ToggleOperation>>[1][number]
  : never;

type EntryCreator<
  TE extends TransactionEntry,
  Target extends string | undefined
> = {
  target: <K extends TE extends TransactionEntry<infer K, any> ? K : never>(
    target: K
  ) => EntryCreator<TE, K>;
  splice: <S extends InferSplice<TE, Target>>(
    ...splice: (
      | {
          index: S[0];
          remove?: S[1];
          insert?: S[2];
        }
      | undefined
    )[]
  ) => EntryCreator<TE, Target>;
  toggle: <T extends InferToggle<TE, Target>>(
    ...toggle: (
      | {
          [ObjKey in T[0]]: {
            name: ObjKey;
            value: Extract<T, [ObjKey, any]>[1];
          };
        }[T[0]]
      | undefined
    )[]
  ) => EntryCreator<TE, Target>;
};

export const createTransaction = <
  TE extends TransactionEntry,
  Target extends string | undefined
>(
  callback: (t: EntryCreator<TE, Target>) => EntryCreator<TE, Target>
): Transaction<TE> => {
  const entries: Record<string, any> = [];
  let currentTarget: string | undefined = undefined;

  const obj: EntryCreator<TE, Target> = {
    target<NewTarget extends string>(target: NewTarget) {
      currentTarget = target;
      return this;
    },
    splice(...ops_) {
      if (!currentTarget) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        if (!entries[currentTarget]) entries[currentTarget] = [];
        entries[currentTarget].push(
          ...ops.map(({ index, remove, insert }) =>
            insert
              ? [index, remove ?? 0, insert]
              : remove
              ? [index, remove]
              : [index]
          )
        );
      }
      return this;
    },
    toggle(...ops_) {
      if (!currentTarget) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        if (!entries[currentTarget]) entries[currentTarget] = [];
        entries[currentTarget].push(
          ...ops.map(({ name, value }) => [name, value])
        );
      }
      return this;
    },
  };

  callback(obj);

  return Object.entries(entries) as Transaction<TE>;
};

/*
interface EntryCreator<TE extends TransactionEntry, Target extends string> {
  addSplice: () => EntryCreator<TE, Target>;
}

function entry<TE extends TransactionEntry, Target extends string>(
  target: Target
): EntryCreator<TE, Target> {
  const operations: TE[1] = [];

  type Key = TE extends TransactionEntry<infer Key, any> ? Key : never;
  type Splice<K extends Key> = Extract<
    TE,
    TransactionEntry<K, SpliceOperation>
  >[1][number];
  type Toggle<K extends Key> = Extract<
    TE,
    TransactionEntry<K, ToggleOperation>
  >[1][number];

  const obj = {
    addSplice<S extends Splice<Target>>(
      ...ops_: (
        | {
            index: S[0];
            remove?: S[1];
            insert?: S[2];
          }
        | undefined
      )[]
    ) {
      if (!target) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        operations.push(
          ...ops.map(({ index, remove, insert }) =>
            insert
              ? [index, remove ?? 0, insert]
              : remove
              ? [index, remove]
              : [index]
          )
        );
      }
      return obj;
    },
    addToggle<T extends Toggle<Target>>(
      ...ops_: ({ name: T[0]; value: T[1] } | undefined)[]
    ) {
      if (!target) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        operations.push(...ops.map(({ name, value }) => [name, value]));
      }
      return obj;
    },
    create() {
      return [target, operations] as [TE[0], TE[1]];
    },
  };

  return obj;
}

function create<TE extends TransactionEntry>(
  ...entries: EntryCreator<TE, string>[]
) {
  return entries
    .map((el) => el.create())
    .filter((el) => el[1].length > 0) as Transaction<TE>;
}

export const t = {
  create,
  entry,
};
*/
