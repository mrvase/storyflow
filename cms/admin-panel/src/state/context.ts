import { DocumentId, NestedDocumentId } from "@storyflow/shared/types";
import { batch, State, Store } from "@storyflow/state";
import React from "react";

export const context = new Store();

export function getContextKey(documentId: string, key: string) {
  return `${documentId}/${key}`;
}

export function useGlobalContext<
  T extends Record<string, any> = Record<string, any>
>(
  documentId: DocumentId | NestedDocumentId,
  values: T | string
): [T, (value: Partial<T>) => void] {
  const sync = React.useMemo(() => {
    const syncs = batch(() => {
      if (typeof values === "string") {
        return [
          context.use<T[keyof T] | undefined>(getContextKey(documentId, values))
            .sync,
        ];
      }
      return Object.entries(values).map(([key, value]) => {
        return context.use<T[keyof T]>(
          getContextKey(documentId, key),
          () => value
        ).sync;
      });
    });

    const keys = (
      typeof values === "string" ? [values] : Object.keys(values)
    ) as (keyof T)[];

    const getValues = () => {
      return keys.reduce((a, c, i) => {
        const value = syncs[i][1]();
        if (value !== undefined) a[c] = value;
        return a;
      }, {} as Partial<T>);
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
        context.use(`${documentId}/${key}`).set(() => value);
      });
    });
  };

  const state = React.useSyncExternalStore(...sync);

  return [state!, setState];
}
