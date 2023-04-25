import type { FieldId } from "@storyflow/shared/types";
import type { SyntaxNode, SyntaxTree, SyntaxTreeRecord } from "./types";

export const isSyntaxTree = (tree: any): tree is SyntaxTree => {
  return (
    tree !== null &&
    typeof tree === "object" &&
    "type" in tree &&
    "children" in tree
  );
};

export const getSyntaxTreeEntries = (record: SyntaxTreeRecord) => {
  return Object.entries(record) as [FieldId, SyntaxTree][];
};

export const traverseSyntaxTree = (
  tree: SyntaxTree,
  callback: (token: Exclude<SyntaxTree["children"][number], SyntaxNode>) => void
) => {
  const traverseNode = (node: SyntaxTree) => {
    node.children.forEach((token) => {
      if (isSyntaxTree(token)) {
        traverseNode(token);
      } else {
        callback(token);
      }
    });
  };
  traverseNode(tree);
};
