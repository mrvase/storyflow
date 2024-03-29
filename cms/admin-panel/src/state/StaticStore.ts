import React from "react";

interface StaticStorage<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  delete: (key: string) => void;
  keys: () => IterableIterator<string>;
}

export const createStaticStore = <
  State extends string | boolean | number | object | null | undefined,
  Store extends StaticStorage<State>
>(
  createStore: (old?: Store) => Store
) => {
  let store: Store | undefined = undefined;

  const subscribers = new Map<string, Set<() => void>>();

  const subscribe = (key: string, callback: () => void) => {
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(callback);
    return () => {
      subscribers.get(key)?.delete(callback);
    };
  };

  const get = (key: string) => {
    if (!store) {
      store = createStore();
    }
    return store.get(key);
  };

  const notify = (key: string) => {
    subscribers.get(key)?.forEach((el) => el());
    const root = subscribers.get("");
    if (root && root.size) {
      // re-create store to trigger re-render
      store = createStore(store);
      root.forEach((el) => el());
    }
  };

  const deleteOne = (key: string) => {
    if (!store) return;
    store.delete(key);
  };

  const deleteMany = (callback: (key: string) => boolean) => {
    if (!store) return;
    new Set(store.keys()).forEach((key) => {
      if (store && callback(key)) {
        store.delete(key);
      }
    });
  };

  const set = (key: string, value: State) => {
    if (!store) store = createStore();
    const current = store.get(key);
    if (current !== value) {
      store.set(key, value);
      notify(key);
    }
  };

  function useStore(initialState?: Store | (() => Store)) {
    const setInitialState = React.useCallback(() => {
      if (initialState !== undefined && store === undefined) {
        store =
          typeof initialState === "function" ? initialState() : initialState;
      } else if (store === undefined) {
        store = createStore();
      }
    }, [initialState]);

    const state = React.useSyncExternalStore(
      (callback) => {
        setInitialState();
        return subscribe("", callback);
      },
      () => {
        setInitialState();
        return store;
      }
    );

    return state!;
  }

  function useKey<InitialState extends State | undefined>(
    key: string,
    initialState?: InitialState | (() => InitialState)
  ): [
    state: InitialState & (State | undefined),
    setState: (value: State | ((ps: State) => State)) => void
  ];
  function useKey<InitialState extends State | undefined, SelectedState>(
    key: string,
    initialState: InitialState | (() => InitialState),
    selector: (value: State | undefined) => SelectedState
  ): [
    state: SelectedState | undefined,
    setState: (value: State | ((ps: State | undefined) => State)) => void
  ];
  function useKey<InitialState extends State | undefined, SelectedState>(
    key: string,
    initialState?: InitialState | (() => InitialState),
    selector?: (value: State | undefined) => SelectedState
  ): [
    state: (InitialState & (State | undefined)) | SelectedState | undefined,
    setState: (value: State | ((ps: State | undefined) => State)) => void
  ] {
    const setInitialState = React.useCallback(() => {
      if (initialState !== undefined && get(key) === undefined) {
        const value =
          typeof initialState === "function" ? initialState() : initialState;
        set(key, value);
      }
    }, [initialState]);

    const state = React.useSyncExternalStore(
      (callback) => {
        setInitialState();
        return subscribe(key, callback);
      },
      () => {
        setInitialState();
        return selector ? selector(get(key)) : get(key);
      }
    );

    const setter = React.useCallback(
      (value: State | ((ps: State | undefined) => State)) => {
        const result = typeof value === "function" ? value(get(key)) : value;
        set(key, result);
      },
      []
    );

    return [state as any, setter];
  }

  return {
    subscribe,
    get,
    set,
    notify,
    deleteOne,
    deleteMany,
    useStore,
    useKey,
  };
};

export const createPurger = (onEmpty: (key: string) => void) => {
  const sources = new Map<string, Set<{}>>();

  return (key: string) => {
    const symbol = {};
    let set = sources.get(key);
    if (!set) {
      set = new Set();
      sources.set(key, set);
    }
    set.add(symbol);
    return () => {
      let set = sources.get(key);
      if (set) {
        set.delete(symbol);
        if (set.size === 0) {
          sources.delete(key);
          onEmpty(key);
        }
      }
    };
  };
};
