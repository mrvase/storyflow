import React from "react";

export function useEvent(handler: (...args: any[]) => void) {
  const handlerRef = React.useRef<((...args: any[]) => void) | null>(null);

  // In a real implementation, this would run before layout effects
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return React.useCallback((...args: any[]) => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current!;
    return fn(...args);
  }, []);
}

/*
function useDirectEffect(track, callback, deps) {
  const valueRef = React.useRef(null);

  React.useEffect(() => {
    valueRef.current = track;
  }, track);

  React.useEffect(() => {
    return callback(valueRef.current);
  }, []);
}
*/
