import React from "react";

export default function useRegister<T>(): [
  React.MutableRefObject<Set<T>>,
  (callback: T) => () => void
];
export default function useRegister<T>(
  getId: (element: T) => string
): [React.MutableRefObject<Map<string, T>>, (callback: T) => () => void];
export default function useRegister<T>(
  getId?: (element: T) => string
): [
  React.MutableRefObject<Set<T> | Map<string, T>>,
  (callback: T) => () => void
] {
  const listeners = React.useRef<Map<string, T> | Set<T>>(
    getId ? new Map() : new Set()
  );

  const registerListener = React.useCallback((element: T) => {
    if (getId) {
      (listeners.current as Map<string, T>).set(getId(element), element);
      return () => {
        (listeners.current as Map<string, T>).delete(getId(element));
      };
    } else {
      (listeners.current as Set<T>).add(element);
      return () => {
        (listeners.current as Set<T>).delete(element);
      };
    }
  }, []);

  return [listeners, registerListener];
}
