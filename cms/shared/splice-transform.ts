import { ServerPackage, unwrapServerPackage } from "@storyflow/state";
import { createServerPackage } from "@storyflow/state";
import { AnyOp, DocumentOp, Splice } from "./operations";

const getClientId = (pkg: ServerPackage<any>) => {
  return unwrapServerPackage(pkg).clientId;
};

const isSplice = <T>(value: any): value is Splice<T> => {
  return value && typeof value === "object" && "index" in value;
};

const moveIndex = <Operation extends AnyOp>(
  index: number,
  packages: ServerPackage<Operation>[],
  getLength: (value: any[]) => number
) => {
  let newIndex = index;

  packages.forEach((pkg) => {
    const { operations } = unwrapServerPackage(pkg);
    operations.forEach(({ ops }) => {
      let spanned = 0;
      let formerRemoved = 0;
      ops.forEach((action) => {
        if (!isSplice(action)) {
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

type SpliceAction = Splice<any>;
type SpliceChar = [SpliceAction | null, number];
type SpliceState = SpliceChar[];

export function createSpliceTransformer<Operation extends AnyOp>(
  getInitialValue: (operation: Operation) => any[],
  _getArrayMethods?: (operation: Operation) => ArrayMethods | undefined
) {
  const getArrayMethods = (operation: Operation) => {
    return _getArrayMethods?.(operation) ?? defaultArrayMethods;
  };

  return (packages: ServerPackage<Operation>[]) => {
    const result: ServerPackage<Operation>[] = [];

    const stateMap = new Map<string, [index: number, state: SpliceState][]>();

    const getStates = (operation: Operation) => {
      let states = stateMap.get(operation.target);
      if (!states) {
        states = [];
        stateMap.set(operation.target, states);
        states.unshift([0, getInitialState(operation)]);
      }
      return states!;
    };

    const getInitialState = (operation: Operation): SpliceState => {
      const length = getArrayMethods(operation).getLength(
        getInitialValue(operation)
      );
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

    const cachedExpansions = new Map<SpliceAction, SpliceState>();

    const expandOperation = (
      operation: Operation,
      action: SpliceAction
    ): SpliceChar[] => {
      let expansion = cachedExpansions.get(action);
      if (expansion) return expansion;
      const length = getArrayMethods(operation).getLength(action.insert ?? []);
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
      operation: DocumentOp<SpliceAction>
    ) => {
      let removed: any[] = [];
      operation.ops.forEach((op) => {
        if (!isSplice(op)) {
          return;
        }
        let insert = expandOperation(operation as any, op) as [
          SpliceAction | null,
          number
        ][];
        if (!op.insert && !op.remove) {
          insert = removed;
        }
        removed = state.splice(op.index, op.remove ?? 0, ...insert);
      });
    };

    packages.forEach((pkg, i) => {
      const { clientId, index, ...rest } = unwrapServerPackage(pkg);

      let operations = rest.operations;

      const interceptions = result.slice(index, i);

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
          let nextState = nextStateMap.get(operation.target);
          if (!nextState) {
            const [, currentState] = getStates(operation).find(
              ([i]) => index >= i
            )!;
            nextState = [...currentState];
            nextStateMap.set(operation.target, nextState);
          }
          return nextState!;
        };

        // find new removes
        operations.forEach((operation, index) => {
          const currentTarget = operation.target;

          let newOps = [] as Operation["ops"];

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
                if (operation.target === currentTarget) {
                  ordinarySpliceTransform(
                    lastSeenState,
                    operation as DocumentOp<SpliceAction>
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
              if (operation.target === currentTarget) {
                ordinarySpliceTransform(
                  state,
                  operation as DocumentOp<SpliceAction>
                );
              }
            });
            return state;
          })();

          let formerRemovals: SpliceChar[] = [];
          operation.ops.forEach((action) => {
            if (!isSplice(action)) {
              newOps.push(action as any);
              return;
            }

            let removals: SpliceChar[] = [];
            let actions: SpliceAction[] = [];

            if (action.remove) {
              // TODO: What if it does not remove something from the lastSeenState, but something inserted in this very serverpackage?
              removals = [...lastSeenState].splice(action.index, action.remove);

              // it might have become multiple operations, since the removed entities might have been split
              actions = removals.reduce((acc, cur) => {
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
                    const operation: SpliceAction = {
                      index: elIndex,
                      remove: 1,
                      insert: [] as any[],
                    };
                    acc.push(operation);
                  }
                }

                return acc;
              }, [] as SpliceAction[]);
            }

            if (action.insert || !action.remove) {
              // now we need to make the inserts at the right spot
              const newIndex = moveIndex(
                action.index,
                externalInterceptions,
                getArrayMethods(operation).getLength
              );

              const existing = actions.find((el) => el.index === newIndex);

              let newAction: SpliceAction = existing ?? {
                index: newIndex,
              };

              if (!action.insert) {
                refs.set(newAction, formerRemovals);
              } else {
                newAction.insert = action.insert;
              }

              if (!existing) {
                actions.push(newAction);
              }
            }

            // handle internal indexes
            let offset = 0;
            actions
              .sort((a, b) => a.index - b.index)
              .forEach((el) => {
                el.index += offset;
                offset += getArrayMethods(operation).getLength(el.insert ?? []);
                offset -= el.remove ?? 0;
              });

            newOps.push(...(actions as any));

            formerRemovals = removals;
          });

          /* transform next state */

          let removed: any[] = [];
          newOps.forEach((action) => {
            if (!isSplice(action)) {
              return;
            }
            let insert = expandOperation(operation, action) as SpliceChar[];
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

          operation.ops = newOps;
        });

        // append next state
        nextStateMap.forEach((value, key) => {
          const states = stateMap.get(key)!;
          states.unshift([i + 1, value]);
        });
      } else {
        // handle next state here as well

        const nextStateMap = new Map<string, SpliceState>();

        const getNextState = (operation: Operation) => {
          let nextState = nextStateMap.get(operation.target);
          if (!nextState) {
            const [, currentState] = getStates(operation)[0];
            nextState = [...currentState];
            nextStateMap.set(operation.target, nextState);
          }
          return nextState!;
        };

        operations.forEach((operation) => {
          const nextState = getNextState(operation);
          ordinarySpliceTransform(
            nextState,
            operation as DocumentOp<SpliceAction>
          );
        });

        // append next state
        nextStateMap.forEach((value, key) => {
          const states = stateMap.get(key)!;
          states.unshift([i + 1, value]);
        });
      }

      result.push(
        createServerPackage({
          ...rest,
          index: i,
          clientId,
          operations,
        }) as any
      );
    });

    return result;
  };
}
