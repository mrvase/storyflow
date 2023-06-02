import React from "react";

export function createGlobalState<TValue>(initialValue: TValue) {
  let value = initialValue;
  const subs = new Set<(payload: TValue) => void>();

  const subscribe = (callback: (payload: TValue) => void) => {
    subs.add(callback);
    return () => {
      subs.delete(callback);
    };
  };

  const notify = (payload: TValue) => {
    value = payload;
    subs.forEach((f) => f(payload));
  };

  return [() => value, notify, subscribe] as [
    () => TValue,
    typeof notify,
    typeof subscribe
  ];
}
export function useGlobalState<TValue>(
  input: ReturnType<typeof createGlobalState<TValue>>
) {
  const [getValue, setState, subscribe] = input;
  const state = React.useSyncExternalStore(subscribe, getValue);
  return [state, setState] as [TValue, (value: TValue) => void];
}

export function useImmutableGlobalState<TValue>(
  input: ReturnType<typeof createGlobalState<TValue>>
) {
  const [getValue, , subscribe] = input;
  return React.useSyncExternalStore(subscribe, getValue);
}

export function createReactSubject<
  Payload extends number | string | boolean | object
>() {
  const uninitialized = Symbol();

  const [getValue, setState, subscribe] = createGlobalState<Payload | Symbol>(
    uninitialized
  );

  return function useSubject(initialValue: Payload | (() => Payload)) {
    const getInitializedSnapshot = () => {
      let value = getValue();
      if (value === uninitialized) {
        value =
          typeof initialValue === "function" ? initialValue() : initialValue;
        setState(value);
      }
      return value;
    };

    const state = React.useSyncExternalStore((callback) => {
      getInitializedSnapshot();
      return subscribe(callback);
    }, getInitializedSnapshot);

    return [state, setState] as [Payload, (value: Payload) => void];
  };
}
