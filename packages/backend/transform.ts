import { isSyntaxTree } from "./syntax-tree";
import { SyntaxTree, Transform } from "./types";

export const splitTransformsAndRoot = (
  tree: SyntaxTree
): [Transform[], SyntaxTree & { type: "root" }] => {
  let transforms: Transform[] = [];
  let root: (SyntaxTree & { type: "root" }) | null = null;

  const traverseNode = (node: SyntaxTree, currentPath: number[] = []) => {
    if (node.type === "root") {
      if (root) {
        throw new Error("You have multiple roots in your transform");
      }
      root = node as SyntaxTree & { type: "root" };
    } else {
      transforms.push({
        type: node.type,
        ...(node.data && { data: node.data }),
      });
      node.children.map((token, index) => {
        if (isSyntaxTree(token)) {
          traverseNode(token, [...currentPath, index]);
        }
      });
    }
  };

  traverseNode(tree);

  if (!root) {
    throw new Error("You have no root node in your syntax tree.");
  }

  return [transforms, root];
};

export const insertRootInTransforms = (
  root: SyntaxTree & { type: "root" },
  transforms: Transform[]
) => {
  return transforms.reduceRight((child: SyntaxTree, transform) => {
    return {
      ...transform,
      children: [child],
    };
  }, root);
};
