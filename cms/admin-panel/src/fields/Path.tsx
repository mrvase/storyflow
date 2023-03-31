import { FieldId, NestedDocumentId } from "@storyflow/backend/types";
import React from "react";
import { useContextWithError } from "../utils/contextError";
import { useIframeListeners } from "./builder/IframeContext";

type PathSegment = FieldId | NestedDocumentId;
type Path = PathSegment[];

export const SelectedPathContext = React.createContext<
  [Path, React.Dispatch<Path>] | null
>(null);
export const PathContext = React.createContext<Path>([]);

export const useSelectedPath = (): [
  {
    path: Path;
    selectedDocument: NestedDocumentId;
    selectedField: FieldId | undefined;
  },
  React.Dispatch<Path>
] => {
  const [path, setPath] = useContextWithError(
    SelectedPathContext,
    "CurrentPath"
  );

  // path = [NestedDocumentId, FieldId, NestedDocumentId, FieldId, ...]

  const isOdd = path.length % 2 === 1;

  const selectedDocument = (
    isOdd ? path[path.length - 2] : path[path.length - 1]
  ) as NestedDocumentId;
  const selectedField = isOdd ? (path[path.length - 1] as FieldId) : undefined;

  return [
    {
      path,
      selectedDocument,
      selectedField,
    },
    setPath,
  ];
};

export const useSelectedBuilderPath = () => {
  const [path, setPath_] = useSelectedPath();

  const setPath = React.useCallback((...args: Parameters<typeof setPath_>) => {
    setPath_(...args);
    // dispatch
  }, []);

  return [path, setPath] as ReturnType<typeof useSelectedPath>;
};

export function useSyncBuilderPath() {
  const listeners = useIframeListeners();
  const [, setPath] = useSelectedPath();

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      setPath(path);
    });
  }, []);
}

export const usePath = (): Path => React.useContext(PathContext);

export function ExtendPath({
  children,
  ...props
}:
  | { children: React.ReactNode; id: FieldId; type: "field" }
  | { children: React.ReactNode; id: NestedDocumentId; type: "document" }) {
  const path = usePath();

  const nextPath = React.useMemo(() => [...path, props.id], [path, props.id]);

  return (
    <PathContext.Provider value={nextPath}>{children}</PathContext.Provider>
  );
}

export function SelectedPathProvider({
  children,
  id,
}: {
  children: React.ReactNode;
  id: FieldId;
}) {
  const state = React.useState<Path>([]);

  return (
    <SelectedPathContext.Provider value={state}>
      {children}
    </SelectedPathContext.Provider>
  );
}
