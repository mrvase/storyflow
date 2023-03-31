import React from "react";
import { Path } from "@storyflow/frontend/types";
import {
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/IframeContext";
import { useContextWithError } from "../utils/contextError";

type PathContextType = [Path, (value: Path | ((ps: Path) => Path)) => void];
export const BuilderPathContext = React.createContext<PathContextType | null>(
  null
);

export const useBuilderPath = () =>
  useContextWithError(BuilderPathContext, "BuilderPath");

export function BuilderPathProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [path, setPathInternal] = React.useState<Path>([]);

  const listeners = useIframeListeners();
  const dispatchers = useIframeDispatchers();

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      // check if path is from own field.
      if (path[path.length - 1].id.match(/\[\d+\]/)) {
        setPathInternal(path.slice(0, -1));
        return;
      }
      setPathInternal(path);
    });
  }, []);

  const setPath = React.useCallback((value: Path | ((ps: Path) => Path)) => {
    setPathInternal((ps) => (typeof value === "function" ? value(ps) : value));
    // dispatch
  }, []);

  const ctx = React.useMemo(
    () => [path, setPath] as [typeof path, typeof setPath],
    [path, setPath]
  );

  return (
    <BuilderPathContext.Provider value={ctx}>
      {children}
    </BuilderPathContext.Provider>
  );
}
