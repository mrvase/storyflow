import React from "react";
import { Path, PathSegment } from "@storyflow/frontend/types";

type PathContextType = [Path, (value: Path | ((ps: Path) => Path)) => void];
export const PathContext = React.createContext<PathContextType | null>(null);

export const stringifyPath = (path: PathSegment[]) => {
  let string = "";
  path.forEach(({ id, parentProp }) => {
    string += `${parentProp ? `/${parentProp.name}` : ""}.${id}`;
  });
  return string.slice(1);
};

export const usePathContext = () => {
  const ctx = React.useContext(PathContext);
  if (!ctx) throw new Error("usePathContext cannot find provider.");
  return ctx;
};
