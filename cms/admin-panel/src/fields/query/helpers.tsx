import { RegularOptions } from "@storyflow/frontend/types";
import { tools } from "shared/editor-tools";
import { ComputationOp } from "shared/operations";

type TextOps = [{ index: number; insert: [string]; remove?: 0 }];

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

export function sortByDomNode<T>(
  nodes: T[],
  resolveKey: (item: T) => HTMLElement | null = (i) =>
    i as unknown as HTMLElement | null
): T[] {
  return nodes.slice().sort((aItem, zItem) => {
    let a = resolveKey(aItem);
    let z = resolveKey(zItem);

    if (a === null || z === null) return 0;

    let position = a.compareDocumentPosition(z);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

export const getOptionLabel = (option: RegularOptions[number]) => {
  return typeof option === "object"
    ? option.label ?? ("value" in option ? option.value : option.name)
    : option;
};

export const markMatchingString = (
  string: string,
  query: string
): React.ReactNode => {
  let i = 0;
  let stringLower = string.toLowerCase();
  let queryLower = query.toLowerCase();
  while (stringLower[i] === queryLower[i]) {
    i++;
    if (i >= string.length || i >= query.length) {
      break;
    }
  }

  return i > 0 ? (
    <>
      <strong className="whitespace-pre">{string.substring(0, i)}</strong>
      <span className="whitespace-pre opacity-80">{string.substring(i)}</span>
    </>
  ) : (
    <span className="whitespace-pre opacity-80">{string}</span>
  );
};
