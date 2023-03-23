import { SyntaxTree, Transform } from "./types";

export const isSyntaxTree = (tree: any): tree is SyntaxTree => {
  return (
    tree !== null &&
    typeof tree === "object" &&
    "type" in tree &&
    "children" in tree
  );
};

export const isSyntaxTreeOrTransform = (tree: any): tree is Transform => {
  return tree !== null && typeof tree === "object" && "type" in tree;
};
