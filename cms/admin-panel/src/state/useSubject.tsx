import React from "react";

export function useSubject<Payload>(initialValue: Payload) {
  const subs = new Set<(payload: Payload) => void>();
  const subscribe = (callback: (payload: Payload) => void) => {
    subs.add(callback);
    return () => {
      subs.delete(callback);
    };
  };

  let snapshot = initialValue;

  const notify = (payload: Payload) => {
    snapshot = payload;
    subs.forEach((f) => f(payload));
  };

  const getSnapshot = () => {
    return snapshot;
  };

  return [subscribe, notify, getSnapshot] as [
    typeof subscribe,
    typeof notify,
    () => Payload
  ];
}

export function createReactSubject<
  Payload extends number | string | boolean | object
>() {
  let uninitialized = Symbol();

  const [subscribe, setState, getSnapshot] = useSubject<Payload | Symbol>(
    uninitialized
  );

  return function useSubject(initialValue: Payload | (() => Payload)) {
    const state = React.useSyncExternalStore(
      (callback) => {
        let value = getSnapshot();
        if (value === uninitialized) {
          setState(
            typeof initialValue === "function" ? initialValue() : initialValue
          );
        }
        return subscribe(callback);
      },
      () => {
        let value = getSnapshot();
        if (value === uninitialized) {
          setState(
            typeof initialValue === "function" ? initialValue() : initialValue
          );
        }
        return value;
      }
    );

    return [state, setState] as [Payload, (value: Payload) => void];
  };
}
