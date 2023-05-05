import type {
  SpliceOperation,
  TimelineEntry,
  TransactionEntry,
} from "@storyflow/collab/types";
import { isSpliceOperation, read } from "@storyflow/collab/utils";

const updateIndex = (
  target: string,
  index: number,
  interceptions: ReturnType<typeof read>[],
  getLength: (target: string, value: any[]) => number
) => {
  let newIndex = index;

  interceptions.forEach((pkg) => {
    const transactions = pkg.transactions;
    transactions.forEach((transaction) => {
      transaction.forEach(([extTarget, operations]) => {
        if (target !== extTarget) return;

        let spanned = 0;
        let formerRemoved = 0;
        operations.forEach((operation) => {
          if (!isSpliceOperation(operation)) {
            return;
          }
          const [opIndex, opRemove, opInsert] = operation;
          if (spanned > 0 && !opRemove && !opInsert) {
            // portal
            newIndex = opIndex + spanned;
          } else if (opIndex < newIndex) {
            if (opIndex + (opRemove ?? 0) > newIndex) {
              spanned = newIndex - opIndex;
            } else {
              spanned = 0;
            }

            const insert =
              !opInsert && !opRemove
                ? formerRemoved
                : getLength(target, opInsert ?? []);
            newIndex += insert;

            let remove = Math.min(opRemove ?? 0, newIndex - opIndex);
            newIndex -= remove;
          } else if (opIndex === newIndex) {
            const insert =
              !opInsert && !opRemove
                ? formerRemoved
                : getLength(target, opInsert ?? []);
            newIndex += insert;
            spanned = 0;
          }
          formerRemoved = opRemove ?? 0;
        });
      });
    });
  });

  return newIndex;
};

type SpliceChar = [SpliceOperation | null, number];
type SpliceState = SpliceChar[];

const createInitializingMap = <T>(initializer: (target: string) => T) => {
  const map = new Map<string, T>();

  function get(target: string): T {
    let current = map.get(target);
    if (!current) {
      current = initializer(target);
      map.set(target, current);
    }
    return current;
  }

  return {
    get,
    forEach(...args: Parameters<Map<string, T>["forEach"]>) {
      return map.forEach(...args);
    },
  };
};

const updateOperations = (
  entry: TransactionEntry,
  interceptions: ReturnType<typeof read>[],
  getLength: (target: string, value: any[]) => number,
  states: {
    lastSeenState: SpliceState;
    currentState: SpliceState;
  }
) => {
  let newActions = [] as TransactionEntry[1];

  const target = entry[0];

  entry[1].forEach((operation) => {
    if (!isSpliceOperation(operation)) {
      newActions.push(operation);
      return;
    }

    let spliceActions: SpliceOperation[] = [];

    const [index, remove, insert] = operation;

    if (remove) {
      const removals = [...states.lastSeenState].splice(index, remove);

      // it might have become multiple operations, since the removed entities might have been split
      spliceActions = removals.reduce((acc, cur) => {
        const former = acc[acc.length - 1];
        const elIndex = states.currentState.findIndex((el) => el === cur);

        if (elIndex >= 0) {
          if (former && elIndex === former[0] + (former[1] ?? 0)) {
            former[1] = (former[1] ?? 0) + 1;
          } else {
            const newSpliceAction: SpliceOperation = [elIndex, 1];
            acc.push(newSpliceAction);
          }
        }

        return acc;
      }, [] as SpliceOperation[]);
    }

    if (insert || !remove) {
      // now we need to make the inserts at the right spot
      const newIndex = updateIndex(target, index, interceptions, getLength);

      const existing = spliceActions.find((el) => el[0] === newIndex);

      const newSpliceAction: SpliceOperation = existing ?? [newIndex, 0];

      if (insert) {
        newSpliceAction[2] = insert;
      }

      if (!existing) {
        spliceActions.push(newSpliceAction);
      }
    }

    // handle internal indexes
    let offset = 0;
    spliceActions
      .sort((a, b) => a[0] - b[0])
      .forEach((el) => {
        el[0] += offset;
        const [, remove, insert] = el;
        offset += getLength(target, insert ?? []);
        offset -= remove ?? 0;
      });

    newActions.push(...(spliceActions as any));
  });

  return newActions;
};

const createPseudoStateSplicer = (
  getLength: (target: string, value: any[]) => number
) => {
  /**
   * createChars produces an object reference (array with inserts and index)
   * for each character of inserts. We do this to have a unique identifier
   * for each character. This allows us to find exactly the characters
   * a remove operation was intended to operate on.
   */

  /**
   * We need to cache the creations because we sometimes do the creation
   * multiple times when we construct multiple "state routes" that have
   * been traversed. (e.g. the actual shared state vs temporary local state)
   */
  const cache = new Map<Required<SpliceOperation[2]>, SpliceState>();

  const createChars = (
    target: string,
    operation: SpliceOperation
  ): SpliceChar[] => {
    const insert = operation[2];
    if (!insert) return [];
    let chars = cache.get(insert);
    if (chars) return chars;
    const length = getLength(target, insert ?? []);
    chars = Array.from(
      { length },
      (_, index) => [operation, index] as SpliceChar
    );
    cache.set(insert, chars);
    return chars;
  };

  /** END */

  const splice = (state: SpliceState, entry: TransactionEntry) => {
    const removed: SpliceChar[] = [];
    entry[1].forEach((operation) => {
      if (!isSpliceOperation(operation)) return;

      const [index, remove, insert] = operation;

      const isMove = !remove && !insert;
      let charInsert: SpliceChar[] = isMove
        ? removed
        : createChars(entry[0], operation);
      const currentlyRemoved = state.splice(index, remove ?? 0, ...charInsert);
      removed.push(...currentlyRemoved);
    });
  };

  return splice;
};

export function createSpliceTransformer(
  getInitialLength: (target: string) => number,
  getLength: (target: string, value: any[]) => number = (value) => value.length
) {
  return (timeline: TimelineEntry[]) => {
    type SpliceStateArray = [index: number, state: SpliceState][];

    const statesMap = createInitializingMap((target: string) => {
      const state: SpliceState = Array.from(
        { length: getInitialLength(target) },
        (_, i) => [null, i]
      );
      return [[0, state]] as SpliceStateArray;
    });

    const splice = createPseudoStateSplicer(getLength);

    const transformPackage = (
      pkg: TimelineEntry,
      packageIndex: number,
      transformedTimeline: TimelineEntry[]
    ) => {
      const { prev, user, queue: queueId, transactions } = read(pkg);

      const index = prev;

      const queue = transformedTimeline.filter((el) => el[0] === queueId);

      const queueIndex = queue.findIndex((el) => el === pkg);

      const firstActivePkg = queue.find((el) => el.length > 3);

      if (!firstActivePkg || !transactions.length) {
        return;
      }

      // the first non-shadow folder refers to the current version
      const version = read(firstActivePkg).prev;

      const interceptions = queue
        .slice(index, queueIndex)
        .map((el) => read(el));

      const externalInterceptions = interceptions.filter(
        (el) => el.transactions.length && el.user !== user
      );

      const lastSeenStateInit = (target: string) => {
        // copy of last seen state
        // since the highest index is first, we find the first state that is equal to or lower than the current index
        const lastSeenState = statesMap
          .get(target)
          .find(([i]) => i <= index)![1]
          .slice();

        const knownInterceptions = interceptions.filter(
          (el) => el.transactions.length && el.user === user
        );

        if (knownInterceptions.length) {
          // we apply the known interceptions to get the state that these operations were applied to

          knownInterceptions.forEach((interception) => {
            interception.transactions.forEach((transaction) => {
              transaction.map((entry) => {
                if (entry[0] === target) {
                  splice(lastSeenState, entry);
                }
              });
            });
          });
        }

        return lastSeenState;
      };

      const currentStateMap = createInitializingMap((target: string) => {
        // copy of latest state
        return statesMap.get(target)[0][1].slice();
      });

      const lastSeenStateMap = createInitializingMap(lastSeenStateInit);

      const isIntercepted = Boolean(externalInterceptions.length);

      transactions.forEach((entries) => {
        entries.forEach((entry) => {
          const target = entry[0];
          const currentState = currentStateMap.get(target);

          if (isIntercepted) {
            const lastSeenState = lastSeenStateMap.get(target);

            const newOperations = updateOperations(
              entry,
              externalInterceptions,
              getLength,
              {
                currentState,
                lastSeenState,
              }
            );

            splice(lastSeenState, entry); // in the next operation, the current operation is seen
            entry[1] = newOperations; // Operation array reference maintained
          }

          splice(currentState, entry);
        });
      });

      // append next state
      currentStateMap.forEach((state, key) => {
        const states = statesMap.get(key);
        states.unshift([packageIndex + 1, state]);
      });

      transformedTimeline[packageIndex] = [
        queueId,
        version + queueIndex,
        user,
        ...transactions,
      ];
    };

    const transformedTimeline: TimelineEntry[] = [...timeline];
    transformedTimeline.forEach(transformPackage);
    return transformedTimeline;
  };
}
