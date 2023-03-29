import React from "react";
import { Path, PathSegment } from "@storyflow/frontend/types";
import {
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/IframeContext";
import { useContextWithError } from "../utils/contextError";
import ReactDOM from "react-dom";
import { FieldId, NestedDocumentId } from "@storyflow/backend/types";

type PathContextType = [Path, (value: Path | ((ps: Path) => Path)) => void];
export const BuilderPathContext = React.createContext<PathContextType | null>(
  null
);

export const NestedPortalContext = React.createContext<HTMLDivElement | null>(
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

  const [portal, setPortalState] = React.useState<HTMLDivElement | null>(null);
  const setPortal = React.useCallback((node: HTMLDivElement) => {
    if (node) {
      setPortalState(node);
    }
  }, []);

  return (
    <BuilderPathContext.Provider value={ctx}>
      <NestedPortalContext.Provider value={portal}>
        <div ref={setPortal} className="child:hidden last:child:block">
          {children}
        </div>
      </NestedPortalContext.Provider>
    </BuilderPathContext.Provider>
  );
}

export function NestedPortal({
  children,
  id,
}: {
  children: React.ReactElement;
  id: NestedDocumentId;
}) {
  const [path] = useBuilderPath();
  const currentId = path[path.length - 1]?.id;

  const portal = React.useContext(NestedPortalContext);

  if (!portal) {
    return null;
  }

  return currentId === id ? ReactDOM.createPortal(children, portal) : children;
}
