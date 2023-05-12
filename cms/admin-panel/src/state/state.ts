import { State, Store } from "@storyflow/state";
import React from "react";

export const store = new Store();

export function useGlobalState<T>(
  id: string | undefined
): [T | undefined, (fn: (value: T | undefined) => Promise<T> | T) => void];
export function useGlobalState<T>(
  id: string | undefined,
  fn: (value: T | undefined) => Promise<T> | T
): [T, (fn: (value: T | undefined) => Promise<T> | T) => void];
export function useGlobalState<T>(
  id: string | undefined,
  fn: ((value: T | undefined) => Promise<T> | T) | undefined
): [T | undefined, (fn: (value: T | undefined) => Promise<T> | T) => void];
export function useGlobalState<T>(
  id: string | undefined,
  fn?: ((value: T | undefined) => Promise<T> | T) | undefined
): [T | undefined, (fn: (value: T | undefined) => Promise<T> | T) => void] {
  const s = React.useMemo(() => {
    if (!id) {
      return {
        sync: [() => () => {}, () => undefined] as State<T | undefined>["sync"],
        set: () => {},
      };
    }
    const state = store.use<T>(id, fn!);
    return state;
  }, [id]);

  const state = React.useSyncExternalStore(...s.sync);

  const setter = React.useCallback(
    (fn: (value: T | undefined) => Promise<T> | T) => {
      s.set(fn);
    },
    [s]
  );

  return React.useMemo(() => [state, setter], [state, s]);
}
