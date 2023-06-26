import React from "react";
import { createStaticStore } from "./StaticStore";

const createJSONLocalStorage = () => {
  // this makes sure that references are kept
  const cached = new Map<string, any>();
  return {
    get: (key: string) => {
      if (typeof window === "undefined") return;
      const cachedValue = cached.get(key);
      if (cachedValue) return cachedValue;
      const item = localStorage.getItem(key);
      if (!item) return;
      const json = JSON.parse(item);
      cached.set(key, json);
      return json;
    },
    set: (key: string, value: any) => {
      cached.set(key, value);
      localStorage.setItem(key, JSON.stringify(value));
    },
    delete: (key: string) => {
      cached.delete(key);
      localStorage.removeItem(key);
    },
    keys: function* () {
      for (let i = 0; i < localStorage.length; i++) {
        yield localStorage.key(i)!;
      }
    },
  };
};

type Value = string | boolean | number | object | null;

export const ls = createStaticStore<
  Value | undefined,
  ReturnType<typeof createJSONLocalStorage>
>(() => createJSONLocalStorage());

export const useLocalStorage = <T extends Value>(
  name: string,
  initialValue: T
) => {
  const [state, setState] = ls.useKey(name) as [
    T | undefined,
    (value: T) => void
  ];

  const value = React.useMemo(() => {
    if (state === undefined) return initialValue;
    return state;
  }, [state]);

  const setValue = React.useCallback(
    (arg: T | ((value: T) => T)) => {
      setState(typeof arg === "function" ? arg(value) : arg);
    },
    [value]
  );

  return [value, setValue] as [typeof value, typeof setValue];
};
