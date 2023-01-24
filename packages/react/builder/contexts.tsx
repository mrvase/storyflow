import React from "react";
import { extendPath } from "./extendPath";
import { dispatchers } from "./events";
import { Path, PathSegment } from "@storyflow/frontend/types";
import { stringifyPath } from "./RenderBuilder";

/**
 * BUILDER SELECTION CONTEXT
 */

type BuilderSelectionContextType = [
  subscribe: (callback: (selection: Path) => void) => () => void,
  select: (selection: Path) => void,
  deselect: (path: Path) => void
];

const BuilderSelectionContext =
  React.createContext<BuilderSelectionContextType>([
    () => () => {},
    () => {},
    () => {},
  ]);

export function BuilderSelectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // const t = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const selection = React.useRef<Path>([]);
  const listeners = React.useRef<Set<(selection: Path) => void>>(new Set());

  const setSelection = (newSelection: Path) => {
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
        /*
        if (t.current) {
          clearTimeout(t.current);
        }
        */
        dispatchers.selection.dispatch(newSelection);
        setSelection(newSelection);
      },
      (path: Path) => {
        // t.current = setTimeout(() => {
        if (
          path.length === 0 ||
          stringifyPath(selection.current) === stringifyPath(path)
        ) {
          dispatchers.selection.dispatch([]);
          setSelection([]);
        }
        // });
      },
    ];
  }, []);

  return (
    <BuilderSelectionContext.Provider value={ctx}>
      {children}
    </BuilderSelectionContext.Provider>
  );
}

export function AddPathSegment({
  children,
  segment,
}: {
  children: React.ReactNode;
  segment: PathSegment;
}) {
  const [subscribe, select, deselect] = useBuilderSelection();

  const ctx = React.useMemo((): BuilderSelectionContextType => {
    return [
      subscribe,
      (selection) => {
        select([segment, ...selection]);
      },
      deselect,
    ];
  }, [segment]);

  return (
    <BuilderSelectionContext.Provider value={ctx}>
      {children}
    </BuilderSelectionContext.Provider>
  );
}

export const useBuilderSelection = () => {
  return React.useContext(BuilderSelectionContext);
};

/**
 * PATH CONTEXT
 */

const PathContext = React.createContext<string>("");

export const usePath = () => {
  return React.useContext(PathContext);
};

export const ExtendPath = ({
  children,
  extend = "",
  spacer = ".",
  reset = false,
}: {
  children: React.ReactNode;
  extend?: string;
  spacer?: string;
  reset?: boolean;
}) => {
  const path = usePath();
  return (
    <PathContext.Provider
      value={reset ? extend : extendPath(path, extend, spacer)}
    >
      {children}
    </PathContext.Provider>
  );
};
