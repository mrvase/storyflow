import { State, Store } from "@storyflow/state";
import React from "react";

export const store = new Store();

export function useGlobalState<T>(
  id: string | undefined
): [T | undefined, (fn: (value: T | undefined) => Promise<T> | T) => void];
export function useGlobalState<T>(
  id: string | undefined,
  fn: (value: T | undefined) => Promise<T> | T,
  options?: { cluster?: string }
): [T, (fn: (value: T | undefined) => Promise<T> | T) => void];
export function useGlobalState<T>(
  id: string | undefined,
  fn?: ((value: T | undefined) => Promise<T> | T) | undefined,
  options: { cluster?: string } = {}
): [T | undefined, (fn: (value: T | undefined) => Promise<T> | T) => void] {
  const s = React.useMemo(() => {
    if (!id) {
      return {
        sync: [() => () => {}, () => undefined] as State<T | undefined>["sync"],
        set: () => {},
      };
    }
    const state = store.use<T>(id, fn!, options);
    return state;
  }, [id]);

  const state = React.useSyncExternalStore(...s.sync);

  return [
    state,
    (fn) => {
      s.set(fn);
    },
  ];
}
