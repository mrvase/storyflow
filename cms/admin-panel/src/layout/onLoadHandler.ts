import React from "react";

export function useOnLoadHandler(loaded: boolean, onLoad?: () => void) {
  const loadedMemo = React.useRef(false);

  React.useEffect(() => {
    if (loaded && !loadedMemo.current) {
      loadedMemo.current = true;
      onLoad?.();
    }
  }, [loaded]);

  return null;
}
