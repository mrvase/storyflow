import { FieldType, SyntaxTree, Transform } from "@storyflow/backend/types";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import {
  isSyntaxTree,
  isSyntaxTreeOrTransform,
} from "@storyflow/backend/syntax-tree";

const fieldConfig = {
  default: {
    defaultChildren: [] as [],
  },
  url: {
    transform: {
      type: "url",
    },
    defaultChildren: ["", ""],
  },
  slug: {
    transform: {
      type: "slug",
    },
    defaultChildren: [] as [],
  },
  fetch: {
    transform: {
      type: "sortlimit",
      data: {
        limit: 10,
      },
    },
    defaultChildren: [] as [],
  },
} satisfies Record<
  FieldType,
  { transform?: Transform; defaultChildren: SyntaxTree["children"] }
>;

export const retrieveRoot = (
  tree: SyntaxTree
): SyntaxTree & { type: "root" } => {
  let root: (SyntaxTree & { type: "root" }) | null = null;

  const traverseNode = (node: SyntaxTree, currentPath: number[] = []) => {
    if (node.type === "root") {
      if (root) {
        throw new Error("You have multiple roots in your transform");
      }
      root = node as SyntaxTree & { type: "root" };
    } else {
      node.children.map((token, index) => {
        if (isSyntaxTreeOrTransform(token)) {
          traverseNode(token, [...currentPath, index]);
        }
      });
    }
  };

  traverseNode(tree);

  if (!root) {
    throw new Error("You have no root node in your syntax tree.");
  }

  return root;

  /*
  let path = null as number[] | null;

  const traverseNode = (node: Transform, currentPath: number[] = []) => {
    if (!node.children) {
      if (path) {
        throw new Error("You have multiple insert points in your transform");
      }
      path = currentPath;
    } else {
      node.children.map((token, index) => {
        if (isSyntaxTreeOrTransform(token)) {
          traverseNode(token, [...currentPath, index]);
        }
      });
    }
  };

  traverseNode(transform);

  if (!path) {
    throw new Error(
      "You have no insert points in your transform to retrieve children from."
    );
  }

  const children = path.reduce((acc: SyntaxTree, key) => {
    const child = acc.children[key];
    if (!isSyntaxTree(child)) {
      throw new Error("Something went wrong");
    }
    return child;
  }, tree).children;

  if (!children) {
    throw new Error(
      "It was not possible to locate the children inside a transformed syntax tree"
    );
  }

  return children;
  */
};

export const insertRootInTransform = (
  root: SyntaxTree & { type: "root" },
  transform: Transform
) => {
  let found = false;

  const modifyNode = (node: Transform): SyntaxTree => {
    if (!node.children) {
      if (found) {
        throw new Error("You have multiple insert points in your transform");
      }
      found = true;
      return {
        ...node,
        children: [root],
      };
    } else {
      return {
        ...node,
        children: node.children.map((token) => {
          if (isSyntaxTreeOrTransform(token)) {
            return modifyNode(token);
          }
          return token;
        }),
      };
    }
  };

  const reconstructed = modifyNode(transform);

  if (!found) {
    throw new Error(
      "You have no insert points in your transform to insert the root into."
    );
  }

  return reconstructed;
};

export const getConfig = <T extends keyof typeof fieldConfig>(
  key: T
): (typeof fieldConfig)[T] & { defaultValue: SyntaxTree } => {
  const config = fieldConfig[key];
  if (!config) {
    throw new Error("Unknown field type used to request config.");
  }

  const root = {
    ...DEFAULT_SYNTAX_TREE,
    children: config.defaultChildren,
  };

  return {
    ...config,
    defaultValue:
      "transform" in config
        ? insertRootInTransform(root, config.transform)
        : root,
  };
};
