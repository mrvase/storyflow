import React from "react";
import { Path, PathSegment } from "@storyflow/frontend/types";
import { useFieldId } from "./FieldIdContext";
import {
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/BuilderIframe";
import { useContextWithError } from "../utils/contextError";

type PathContextType = [Path, (value: Path | ((ps: Path) => Path)) => void];
export const BuilderPathContext = React.createContext<PathContextType | null>(
  null
);

export const stringifyPath = (path: PathSegment[]) => {
  let string = "";
  path.forEach((el) => {
    string += `${
      "parentProp" in el && el.parentProp ? `/${el.parentProp}` : ""
    }.${el.id}`;
  });
  return string.slice(1);
};

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

  console.log("PATH", path);

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      // check if path is from own field.
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
