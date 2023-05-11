import React from "react";

export function useAbortableEffect(
  callback: (signal: AbortController["signal"]) => void | (() => void),
  deps: React.DependencyList
) {
  return React.useEffect(() => {
    const abortController = new AbortController();
    const cleanup = callback(abortController.signal);
    return () => {
      abortController.abort();
      cleanup?.();
    };
  }, deps);
}
