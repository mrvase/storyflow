import { tools } from "shared/editor-tools";
import { ComputationOp } from "shared/operations";
import { TextOps } from "./Query";

export const isTextInsert = (ops: ComputationOp["ops"]): ops is TextOps => {
  return (
    ops.length === 1 &&
    Array.isArray(ops[0].insert) &&
    ops[0].insert.length === 1 &&
    !ops[0].remove &&
    typeof ops[0].insert[0] === "string"
  );
};

export const isAdjacent = (
  prev: ComputationOp["ops"],
  next: ComputationOp["ops"]
): boolean => {
  if (prev.length !== 1 || next.length !== 1) return false;
  const prevEndingIndex =
    prev[0].index +
    tools.getLength(prev[0].insert ?? []) -
    (prev[0].remove ?? 0);
  const nextStartingIndex = next[0].index + (next[0].remove ?? 0);
  return prevEndingIndex === nextStartingIndex;
};

export type QueryType = "<" | "@" | "#" | "/" | ".";

export const getQueryType = (
  query: string,
  index: number
): QueryType | null => {
  // Avoid matching a query, when there is a space immediately after the query symbol.
  // This prevents the command that adds "# " to create a headline from triggering the query.
  const match = query.match(
    /^([\@\#\/\<\.])([^\s]|$)/
  )?.[1] as QueryType | null;
  if (!match || ([".", "#"].includes(match) && index !== 0)) {
    return null;
  }
  return match;
};
