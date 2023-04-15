import { ServerPackage, unwrapServerPackage } from "@storyflow/state";
import { createServerPackage } from "@storyflow/state";
import { StdOperation, SpliceAction, isSpliceAction } from "./operations";

const getClientId = (pkg: ServerPackage<any>) => {
  return unwrapServerPackage(pkg).clientId;
};

const moveIndex = <Operation extends StdOperation>(
  index: number,
  packages: ServerPackage<Operation>[],
  getLength: (value: any[]) => number
) => {
  let newIndex = index;

  packages.forEach((pkg) => {
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

type ArrayMethods = {
  splice: (array: any[], deleteCount: number, ...inserts: any[]) => any[];
  getLength: (array: any[]) => number;
};

const defaultArrayMethods: ArrayMethods = {
  splice: (arr, index, deleteCount, inserts) =>
    arr.splice(index, deleteCount, ...inserts),
  getLength: (arr) => arr.length,
};

/*
const getArrayMethods = <Operation extends AnyOp>(
  operation: Operation
): ArrayMethods => {
  const { input } = targetTools.parse(operation.target);
  return arrayMethodsRecord[input as "computation"] ?? defaultArrayMethods;
};
*/

type SpliceChar = [SpliceAction<any> | null, number];
type SpliceState = SpliceChar[];

export function createSpliceTransformer<Operation extends StdOperation>(
  getInitialValue: (operation: Operation) => any[],
  arrayMethods: ArrayMethods | undefined = defaultArrayMethods
) {
  return (packages: ServerPackage<Operation>[]) => {
    const result: ServerPackage<Operation>[] = [];

    const stateMap = new Map<string, [index: number, state: SpliceState][]>();

    const getStates = (operation: Operation) => {
      let states = stateMap.get(operation[0]);
      if (!states) {
        states = [];
        stateMap.set(operation[0], states);
        states.unshift([0, getInitialState(operation)]);
      }
      return states!;
    };

    const getInitialState = (operation: Operation): SpliceState => {
      const length = arrayMethods.getLength(getInitialValue(operation));
      return Array.from({ length }, (_, index) => [null, index]);
    };

    /**
     * This is all about the references!
     * expandOperation produces an object reference (array with op and index)
     * for each character of inserts. We do this to have a unique identifier
     * for each character. This allows us to find exactly the characters
     * a remove operation was intended to operate on.
     * We need to cache the expansions because we sometimes do the expansion
     * multiple times when we construct multiple "state routes" that have
     * been traversed. (e.g. the actual shared state vs temporary local state)
     */

    const cachedExpansions = new Map<SpliceAction<any>, SpliceState>();

    const expandOperation = (action: SpliceAction<any>): SpliceChar[] => {
      let expansion = cachedExpansions.get(action);
      if (expansion) return expansion;
      const length = arrayMethods.getLength(action.insert ?? []);
      expansion = Array.from(
        { length },
        (_, index) => [action, index] as SpliceChar
      );
      cachedExpansions.set(action, expansion);
      return expansion;
    };

    /** END */

    const ordinarySpliceTransform = (
      state: any[],
      operation: StdOperation<SpliceAction<any>>
    ) => {
      let removed: any[] = [];
      operation[1].forEach((op) => {
        if (!isSpliceAction(op)) {
          return;
        }
        let insert = expandOperation(op) as [
          SpliceAction<any> | null,
          number
        ][];
        if (!op.insert && !op.remove) {
          insert = removed;
        }
        removed = state.splice(op.index, op.remove ?? 0, ...insert);
      });
    };

    packages.forEach((pkg, packageIndex) => {
      const { clientId, index, operations, ...rest } = unwrapServerPackage(pkg);

      const interceptions = result.slice(index, packageIndex);

      const externalInterceptions = interceptions.filter(
        (el) => getClientId(el) !== clientId
      );

      if (externalInterceptions.length) {
        // find "interceptions"

        const knownInterceptions = interceptions.filter(
          (el) => getClientId(el) === clientId
        );

        const nextStateMap = new Map<string, SpliceState>();

        const getNextLastSharedState = (operation: Operation) => {
          let nextState = nextStateMap.get(operation[0]);
          if (!nextState) {
            const [, currentState] = getStates(operation).find(
              ([i]) => index >= i
            )!;
            nextState = [...currentState];
            nextStateMap.set(operation[0], nextState);
          }
          return nextState!;
        };

        // find new removes
        operations.forEach((operation, index) => {
          const currentTarget = operation[0];

          let newActions = [] as Operation[1];

          let refs = new WeakMap<any, SpliceChar[]>();

          let states = getStates(operation);

          const nextLastSharedState = getNextLastSharedState(operation);

          let lastSeenState = [...nextLastSharedState]; // MIX lastSharedState with knownInterceptions

          if (knownInterceptions.length) {
            // lastSeenState is only different from lastSharedState when we do the transform
            // on the remaining queue after the pull

            // we apply the known interceptions to get the state that these operations were applied to

            knownInterceptions.forEach((pkg) => {
              const { operations } = unwrapServerPackage(pkg);
              operations.forEach((operation) => {
                if (operation[0] === currentTarget) {
                  ordinarySpliceTransform(
                    lastSeenState,
                    operation as StdOperation<SpliceAction<any>>
                  );
                }
              });
            });
          }

          /** state after  */
          const currentServerPackageState = (() => {
            const [, currentState] = states[0];
            const state = [...currentState];
            operations.slice(0, index).forEach((operation) => {
              if (operation[0] === currentTarget) {
                ordinarySpliceTransform(
                  state,
                  operation as StdOperation<SpliceAction<any>>
                );
              }
            });
            return state;
          })();

          let formerRemovals: SpliceChar[] = [];
          operation[1].forEach((action) => {
            if (!isSpliceAction(action)) {
              newActions.push(action as any);
              return;
            }

            let removals: SpliceChar[] = [];
            let spliceActions: SpliceAction<any>[] = [];

            if (action.remove) {
              // TODO: What if it does not remove something from the lastSeenState, but something inserted in this very serverpackage?
              removals = [...lastSeenState].splice(action.index, action.remove);

              // it might have become multiple operations, since the removed entities might have been split
              spliceActions = removals.reduce((acc, cur) => {
                const former = acc[acc.length - 1];
                const elIndex = currentServerPackageState.findIndex(
                  (el) => el === cur
                );

                if (elIndex >= 0) {
                  if (
                    former &&
                    elIndex === former.index + (former.remove ?? 0)
                  ) {
                    former.remove = (former.remove ?? 0) + 1;
                  } else {
                    const newSpliceAction: SpliceAction<any> = {
                      index: elIndex,
                      remove: 1,
                      insert: [] as any[],
                    };
                    acc.push(newSpliceAction);
                  }
                }

                return acc;
              }, [] as SpliceAction<any>[]);
            }

            if (action.insert || !action.remove) {
              // now we need to make the inserts at the right spot
              const newIndex = moveIndex(
                action.index,
                externalInterceptions,
                arrayMethods.getLength
              );

              const existing = spliceActions.find(
                (el) => el.index === newIndex
              );

              const newSpliceAction: SpliceAction<any> = existing ?? {
                index: newIndex,
              };

              if (!action.insert) {
                refs.set(newSpliceAction, formerRemovals);
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
                offset += arrayMethods.getLength(el.insert ?? []);
                offset -= el.remove ?? 0;
              });

            newActions.push(...(spliceActions as any));

            formerRemovals = removals;
          });

          /* transform next state */

          let removed: any[] = [];
          newActions.forEach((action) => {
            if (!isSpliceAction(action)) {
              return;
            }
            let insert = expandOperation(action) as SpliceChar[];
            if (refs.has(action)) {
              insert = refs.get(action)!;
            } else if (!action.insert && !action.remove) {
              // need to be handled here as well, since refs are not added to
              // operations that have not been through the transform above
              // because of correct indexes
              insert = removed;
            }
            removed = nextLastSharedState.splice(
              action.index,
              action.remove ?? 0,
              ...insert
            );
          });

          // REFERENCE NOT CHANGED
          operation[1] = newActions;
        });

        // append next state
        nextStateMap.forEach((value, key) => {
          const states = stateMap.get(key)!;
          states.unshift([packageIndex + 1, value]);
        });
      } else {
        // handle next state here as well

        const nextStateMap = new Map<string, SpliceState>();

        const getNextState = (operation: Operation) => {
          let nextState = nextStateMap.get(operation[0]);
          if (!nextState) {
            const [, currentState] = getStates(operation)[0];
            nextState = [...currentState];
            nextStateMap.set(operation[0], nextState);
          }
          return nextState!;
        };

        operations.forEach((operation) => {
          const nextState = getNextState(operation);
          ordinarySpliceTransform(
            nextState,
            operation as StdOperation<SpliceAction<any>>
          );
        });

        // append next state
        nextStateMap.forEach((value, key) => {
          const states = stateMap.get(key)!;
          states.unshift([packageIndex + 1, value]);
        });
      }

      result.push(
        createServerPackage({
          ...rest,
          index: packageIndex,
          clientId,
          operations,
        }) as any
      );
    });

    return result;
  };
}
