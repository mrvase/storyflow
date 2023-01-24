import { batch, State, Store } from "@storyflow/state";
import React from "react";

export const context = new Store();

export function getContextKey(articleId: string, key: string) {
  return `${articleId}/${key}`;
}

export function useGlobalContext<
  T extends Record<string, any> = Record<string, any>
>(articleId: string, valuesArg: T | string): [T, (value: Partial<T>) => void] {
  const sync = React.useMemo(() => {
    const isString = typeof valuesArg === "string";
    const values = isString ? { [valuesArg]: "" } : valuesArg;
    const syncs = batch(() =>
      Object.entries(values).map(([key, value]) => {
        return context.use(
          getContextKey(articleId, key),
          isString ? undefined! : () => value
        ).sync;
      })
    );

    const getValues = () => {
      return Object.keys(values).reduce((a, c, i) => {
        a[c] = syncs[i][1]();
        return a;
      }, {} as Record<string, any>) as T;
    };

    let memorized = getValues();

    const getSnapshot = () => {
      const newValues = getValues();
      const memorizedValues = Object.values(memorized);
      if (
        Object.values(newValues).every((el, i) => el === memorizedValues[i])
      ) {
        return memorized;
      }
      return (memorized = newValues);
    };

    const subscribe = (callback: () => void) => {
      const unsubscribers = Object.values(syncs).map(([subscribe]) => {
        /*@ts-ignore*/
        return subscribe(callback);
      });
      return () => {
        unsubscribers.forEach((el) => el());
      };
    };

    return [subscribe, getSnapshot] as State<T>["sync"];
  }, []);

  const setState = (values: Partial<T>) => {
    batch(() => {
      Object.entries(values).forEach(([key, value]) => {
        context.use(`${articleId}/${key}`).set(() => value);
      });
    });
  };

  const state = React.useSyncExternalStore(...sync);

  return [state!, setState];
}
