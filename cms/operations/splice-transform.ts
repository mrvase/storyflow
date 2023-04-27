import { ServerPackage, unwrapServerPackage } from "@storyflow/state";
import { createServerPackage } from "@storyflow/state";
import { StdOperation, SpliceAction, isSpliceAction } from "./actions";

const getClientId = (pkg: ServerPackage<any>) => {
  return unwrapServerPackage(pkg).clientId;
};

const updateIndex = <Operation extends StdOperation>(
  index: number,
  interceptions: ServerPackage<Operation>[],
  getLength: (value: any[]) => number
) => {
  let newIndex = index;

  interceptions.forEach((pkg) => {
    const { operations } = unwrapServerPackage(pkg);
    operations.forEach(([, actions]) => {
      let spanned = 0;
      let formerRemoved = 0;
      actions.forEach((action) => {
        if (!isSpliceAction(action)) {
          return;
        }
        if (spanned > 0 && !action.insert && !action.remove) {
          // portal
          newIndex = action.index + spanned;
        } else if (action.index < newIndex) {
          if (action.index + (action.remove ?? 0) > newIndex) {
            spanned = newIndex - action.index;
          } else {
            spanned = 0;
          }

          const insert =
            !action.insert && !action.remove
              ? formerRemoved
              : getLength(action.insert ?? []);
          newIndex += insert;

          let remove = Math.min(action.remove ?? 0, newIndex - action.index);
          newIndex -= remove;
        } else if (action.index === newIndex) {
          const insert =
            !action.insert && !action.remove
              ? formerRemoved
              : getLength(action.insert ?? []);
          newIndex += insert;
          spanned = 0;
        }
        formerRemoved = action.remove ?? 0;
      });
    });
  });

  return newIndex;
};

type SpliceChar = [SpliceAction<any> | null, number];
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

const updateActions = <Operation extends StdOperation>(
  actions: Operation[1],
  interceptions: ServerPackage<Operation>[],
  getLength: (value: any[]) => number,
  states: {
    lastSeenState: SpliceState;
    currentState: SpliceState;
  }
) => {
  let newActions = [] as Operation[1];

  actions.forEach((action) => {
    if (!isSpliceAction(action)) {
      newActions.push(action as any);
      return;
    }

    let spliceActions: SpliceAction<any>[] = [];

    if (action.remove) {
      const removals = [...states.lastSeenState].splice(
        action.index,
        action.remove
      );

      // it might have become multiple operations, since the removed entities might have been split
      spliceActions = removals.reduce((acc, cur) => {
        const former = acc[acc.length - 1];
        const elIndex = states.currentState.findIndex((el) => el === cur);

        if (elIndex >= 0) {
          if (former && elIndex === former.index + (former.remove ?? 0)) {
            former.remove = (former.remove ?? 0) + 1;
          } else {
            const newSpliceAction: SpliceAction<any> = {
              index: elIndex,
              remove: 1,
            };
            acc.push(newSpliceAction);
          }
        }

        return acc;
      }, [] as SpliceAction<any>[]);
    }

    if (action.insert || !action.remove) {
      // now we need to make the inserts at the right spot
      const newIndex = updateIndex(action.index, interceptions, getLength);

      const existing = spliceActions.find((el) => el.index === newIndex);

      const newSpliceAction: SpliceAction<any> = existing ?? {
        index: newIndex,
      };

      if (!action.insert) {
      } else {
        newSpliceAction.insert = action.insert;
      }

      if (!existing) {
        spliceActions.push(newSpliceAction);
      }
    }

    // handle internal indexes
    let offset = 0;
    spliceActions
      .sort((a, b) => a.index - b.index)
      .forEach((el) => {
        el.index += offset;
        offset += getLength(el.insert ?? []);
        offset -= el.remove ?? 0;
      });

    newActions.push(...(spliceActions as any));
  });

  return newActions;
};

const createPseudoStateSplicer = <Operation extends StdOperation>(
  getLength: (value: any[]) => number
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
  const cache = new Map<Required<SpliceAction<any>["insert"]>, SpliceState>();

  const createChars = (action: SpliceAction<any>): SpliceChar[] => {
    if (!action.insert) return [];
    let chars = cache.get(action.insert);
    if (chars) return chars;
    const length = getLength(action.insert ?? []);
    chars = Array.from({ length }, (_, index) => [action, index] as SpliceChar);
    cache.set(action.insert, chars);
    return chars;
  };

  /** END */

  const splice = (state: SpliceState, actions: Operation[1]) => {
    const removed: SpliceChar[] = [];
    actions.forEach((action) => {
      if (!isSpliceAction(action)) return;

      const isMove = !action.insert && !action.remove;
      let insert: SpliceChar[] = isMove ? removed : createChars(action);
      const currentlyRemoved = state.splice(
        action.index,
        action.remove ?? 0,
        ...insert
      );
      removed.push(...currentlyRemoved);
    });
  };

  return splice;
};

export function createSpliceTransformer<Operation extends StdOperation>(
  getInitialLength: (target: string) => number,
  getLength: (value: any[]) => number = (value) => value.length
) {
  return (timeline: ServerPackage<Operation>[]) => {
    type SpliceStateArray = [index: number, state: SpliceState][];

    const statesMap = createInitializingMap((target: string) => {
      const state: SpliceState = Array.from(
        { length: getInitialLength(target) },
        (_, i) => [null, i]
      );
      return [[0, state]] as SpliceStateArray;
    });

    const splice = createPseudoStateSplicer(getLength);

    // filterServerPackages ensures that the first transaction acts on the initial state/version
    const version = timeline.length
      ? unwrapServerPackage(timeline[0]).index
      : 0;

    const transformPackage = (
      pkg: ServerPackage<Operation>,
      packageIndex: number,
      transformedTimeline: ServerPackage<Operation>[]
    ) => {
      const { clientId, index, operations, ...rest } = unwrapServerPackage(pkg);

      const interceptions = transformedTimeline.slice(index, packageIndex);

      const externalInterceptions = interceptions.filter(
        (el) => getClientId(el) !== clientId
      );

      const lastSeenStateInit = (target: string) => {
        // copy of last seen state
        // since the highest index is first, we find the first state that is equal to or lower than the current index
        const lastSeenState = statesMap
          .get(target)
          .find(([i]) => i <= index)![1]
          .slice();

        const knownInterceptions = interceptions.filter(
          (el) => getClientId(el) === clientId
        );

        if (knownInterceptions.length) {
          // we apply the known interceptions to get the state that these operations were applied to

          knownInterceptions.forEach((pkg) => {
            const { operations } = unwrapServerPackage(pkg);
            operations.forEach(([t, actions]) => {
              if (t === target) {
                splice(lastSeenState, actions);
              }
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

      operations.forEach((operation) => {
        const target = operation[0];
        const currentState = currentStateMap.get(target);

        if (isIntercepted) {
          const lastSeenState = lastSeenStateMap.get(target);

          const newActions = updateActions(
            operation[1],
            externalInterceptions,
            getLength,
            {
              currentState,
              lastSeenState,
            }
          );

          splice(lastSeenState, operation[1]); // in the next operation, the current operation is seen
          operation[1] = newActions; // Operation array reference maintained
        }

        splice(currentState, operation[1]);
      });

      // append next state
      currentStateMap.forEach((state, key) => {
        const states = statesMap.get(key);
        states.unshift([packageIndex + 1, state]);
      });

      transformedTimeline[packageIndex] = createServerPackage({
        ...rest,
        index: version + packageIndex, // they have now seen all previous packages
        clientId,
        operations,
      }) as any;
    };

    const transformedTimeline: ServerPackage<Operation>[] = [...timeline];
    transformedTimeline.forEach(transformPackage);
    return transformedTimeline;
  };
}
