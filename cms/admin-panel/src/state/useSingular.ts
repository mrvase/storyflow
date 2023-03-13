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
