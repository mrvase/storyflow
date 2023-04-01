import {
  FieldId,
  NestedDocumentId,
  NestedEntity,
  NestedField,
  SyntaxTree,
} from "@storyflow/backend/types";
import { createEventsFromIframeToCMS } from "@storyflow/frontend/events";
import React from "react";
import { getChildrenDocuments } from "shared/computation-tools";
import { useGlobalState } from "../state/state";
import { useContextWithError } from "../utils/contextError";
import { useFieldId } from "./FieldIdContext";

type PathSegment = FieldId | NestedDocumentId;
type Path = PathSegment[];

export const SelectedPathContext = React.createContext<
  [Path, React.Dispatch<React.SetStateAction<Path>>] | null
>(null);
export const PathContext = React.createContext<Path>([]);

export const useSelectedPath = (): [
  {
    selectedPath: Path;
    selectedDocument: NestedDocumentId | undefined;
    selectedField: FieldId | undefined;
  },
  React.Dispatch<React.SetStateAction<Path>>
] => {
  const [path, setPath] = useContextWithError(
    SelectedPathContext,
    "SelectedPath"
  );

  // path = [FieldId, NestedDocumentId, FieldId, NestedDocumentId, FieldId, ...]

  const isOdd = path.length % 2 === 1;

  const selectedField = (
    isOdd ? path[path.length - 1] : path[path.length - 2]
  ) as FieldId | undefined;
  const selectedDocument = (isOdd ? undefined : path[path.length - 1]) as
    | NestedDocumentId
    | undefined;

  return [
    {
      selectedPath: path,
      selectedDocument,
      selectedField,
    },
    setPath,
  ];
};

export function SyncBuilderPath({
  id,
  listeners,
}: {
  id: FieldId;
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
}) {
  const [, setPath] = useSelectedPath();

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      console.log("SETTING PATH", path);
      if (path.length) {
        setPath([id, ...(path as Path)]);
      } else {
        setPath([]);
      }
    });
  }, []);

  return null;
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
  onChange,
}: {
  children: React.ReactNode;
  id: FieldId;
  onChange?: (path: Path) => void;
}) {
  const [path, setPath_] = React.useState<Path>([]);

  const setPath = React.useCallback(
    (arg: Parameters<typeof setPath_>[0]) => {
      setPath_((ps) => {
        let nextPath = typeof arg === "function" ? arg(ps) : arg;
        onChange?.(nextPath);
        return nextPath;
      });
    },
    [onChange, id]
  );

  const state = React.useMemo(
    () => [path, setPath] as [typeof path, typeof setPath],
    [path, setPath]
  );

  return (
    <SelectedPathContext.Provider value={state}>
      {children}
    </SelectedPathContext.Provider>
  );
}

export function useNestedEntity({
  fieldId,
  documentId,
}: {
  fieldId: FieldId;
  documentId: NestedDocumentId;
}): NestedEntity | NestedField | undefined {
  const [tree] = useGlobalState<SyntaxTree>(
    fieldId ? `${fieldId}#tree` : undefined
  );

  if (!tree) {
    return;
  }

  const children = getChildrenDocuments(tree);

  return children.find((el) => el.id === documentId);
}

export function useSelectedNestedEntity() {
  const id = useFieldId();
  const [{ selectedDocument, selectedField = id }] = useSelectedPath();

  return useNestedEntity({
    fieldId: selectedField,
    documentId: selectedDocument!,
  });
}
