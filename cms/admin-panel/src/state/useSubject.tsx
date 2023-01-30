import React from "react";
import { useSyncExternalStore } from "react";

export function useSubject<Payload>(initialState: Payload) {
  const subs = new Set<(payload: Payload) => void>();
  const subscribe = (callback: (payload: Payload) => void) => {
    subs.add(callback);
    return () => {
      subs.delete(callback);
    };
  };

  let snapshot = initialState;

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

export function useReactSubject<Payload>(initialState: Payload) {
  const [subscribe, notify, getSnapshot] = React.useMemo(
    () => useSubject(initialState),
    []
  );
  return [subscribe, notify] as [typeof subscribe, typeof notify];
}
