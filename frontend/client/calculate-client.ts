import { ClientSyntaxTree, ValueArray } from "@storyflow/shared/types";
import { spreadImplicitArrays, compute } from "@storyflow/shared/calculate";

const isObject = <T>(el: T): el is T & object =>
  typeof el === "object" && el !== null;

const resolveClientChildren = (
  children: ClientSyntaxTree["children"],
  getState: (token: { state: string }) => ValueArray[number],
  calculateNode: (node: ClientSyntaxTree) => ValueArray[]
) => {
  let acc: ValueArray[] = [];
  children.forEach((child) => {
    if (isObject(child) && "type" in child && "children" in child) {
      // håndterer noget i paranteser
      const result = calculateNode(child);
      if (Array.isArray(result)) {
        acc.push(...result);
      } else {
        acc.push(result);
      }
    } else {
      acc.push(
        child.map((token) => {
          if (isObject(token) && "state" in token) {
            const state = getState(token);
            return state;
          } else {
            return token;
          }
        })
      );
    }
  });

  return acc;
};

export function calculateClient(
  node: ClientSyntaxTree,
  getState: (token: { state: string }) => ValueArray[number],
  getIndex: (doc: string) => number
): ValueArray {
  const calculateNode = (node: ClientSyntaxTree): ValueArray[] => {
    let values = resolveClientChildren(node.children, getState, calculateNode);

    if (node.type === "fetch") {
      // find out what to do here!
      values = [];
    } else if (node.type === "loop") {
      // and here
      const index = getIndex(node.data);
      values = [[values.reduce((acc, cur) => [...acc, ...cur], [])[index]]];
    } else if (node.type === "select") {
      // and here
      values = [];
    } else if (node.type === "root") {
      // do nothing
    } else if (node.type === null) {
      // brackets
      values = [spreadImplicitArrays(values)];
    } else if (node.type === "array") {
      values = [[spreadImplicitArrays(values)]];
    } else {
      values = compute(
        node.type as Exclude<
          typeof node.type,
          "select" | "fetch" | "array" | "root" | null
        >,
        values
      );
    }

    return values;
  };

  const value = calculateNode(node);

  return value.reduce((acc, cur) => [...acc, ...cur], []);
}
