import * as React from "react";
import { dispatchers } from "./events";
import type { Library, LibraryConfig, Path } from "@storyflow/shared/types";

/**
 * BUILDER SELECTION CONTEXT
 */

type BuilderSelectionContextType = [
  subscribe: (callback: (selection: Path) => void) => () => void,
  select: (selection: Path) => void
];

const BuilderSelectionContext =
  React.createContext<BuilderSelectionContextType>([() => () => {}, () => {}]);

export function SelectedPathProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const selection = React.useRef<Path>([]);
  const listeners = React.useRef<Set<(selection: Path) => void>>(new Set());

  const setSelection = (newSelection: Path) => {
    console.log("NEW SELECTION", newSelection);
    selection.current = newSelection;
    listeners.current.forEach((callback) => callback(newSelection));
  };

  const ctx = React.useMemo((): BuilderSelectionContextType => {
    return [
      (callback) => {
        listeners.current.add(callback);
        return () => {
          listeners.current.delete(callback);
        };
      },
      (newSelection: Path) => {
        dispatchers.selection.dispatch(newSelection);
        setSelection(newSelection);
      },
    ];
  }, []);

  return (
    <BuilderSelectionContext.Provider value={ctx}>
      {children}
    </BuilderSelectionContext.Provider>
  );
}

export const useSelectedPath = () => {
  return React.useContext(BuilderSelectionContext);
};

/**
 * PATH CONTEXT
 */

const PathContext = React.createContext<string[]>([]);

export const usePath = () => {
  return React.useContext(PathContext);
};

export function ExtendPath({
  children,
  ...props
}: {
  children: React.ReactNode;
  id: string;
}) {
  const path = usePath();

  const nextPath = React.useMemo(() => [...path, props.id], [path, props.id]);

  return (
    <PathContext.Provider value={nextPath}>{children}</PathContext.Provider>
  );
}

/**
 * CONFIG CONTEXT
 */

export const ConfigContext = React.createContext<{
  configs: Record<string, LibraryConfig>;
  libraries: Record<string, Library>;
} | null>(null);

export const useConfig = () => {
  return React.useContext(ConfigContext)!;
};
