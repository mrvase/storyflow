import React from "react";
import { createStaticStore } from "./StaticStore";

const createJSONLocalStorage = () => {
  return {
    get: (key: string) => {
      if (typeof window === "undefined") return;
      const item = localStorage.getItem(key);
      if (!item) return;
      return JSON.parse(item);
    },
    set: (key: string, value: any) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    delete: (key: string) => {
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

export const ls = createStaticStore<Value | undefined>(
  createJSONLocalStorage()
);

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
