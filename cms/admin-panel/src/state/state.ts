import { State, Store } from "@storyflow/state";
import React from "react";

const map = new Map<string, Symbol[]>();

export const useSingular = (key: string): ((callback: () => void) => void) => {
  const ref = React.useRef(Symbol());

  React.useLayoutEffect(() => {
    map.set(key, [...(map.get(key) ?? []), ref.current]);
    return () => {
      map.set(
        key,
        (map.get(key) ?? []).filter((el) => el !== ref.current)
      );
    };
  }, []);

  return React.useCallback((callback) => {
    if (map.get(key)?.indexOf(ref.current) === 0) {
      callback();
    }
  }, []);
};

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
