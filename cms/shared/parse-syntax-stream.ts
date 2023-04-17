import { unwrapObjectId } from "@storyflow/backend/ids";
import {
  isFunctionSymbol,
  isOperator,
  isOperatorSymbol,
} from "@storyflow/backend/symbols";
import { tokens } from "@storyflow/backend/tokens";
import {
  operators,
  SyntaxNode,
  DBSyntaxStream,
  SyntaxTree,
  WithSyntaxError,
  SyntaxStream,
  SyntaxStreamSymbol,
  Operator,
  FunctionName,
  ValueArray,
  DBValueArray,
  DBId,
  FunctionSymbol,
  HasDBId,
  NestedEntity,
  FunctionData,
} from "@storyflow/backend/types";

const returnToNullParent = (
  current: SyntaxNode<WithSyntaxError>,
  parents: WeakMap<SyntaxNode<WithSyntaxError>, SyntaxNode<WithSyntaxError>>
) => {
  while (current.type !== null && current.type !== "root") {
    current = parents.get(current)!;
  }
  return current;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

function isNestedEntityWithDBId(value: any): value is HasDBId<NestedEntity> {
  return tokens.isNestedEntity(value);
}

type KeysOfUnion<T> = T extends T ? keyof T : never;
type SymbolKey = KeysOfUnion<SyntaxStreamSymbol>;

function isSymbol<T extends ")">(
  value: any,
  type: T
): value is { ")": true | false | Operator };
function isSymbol<T extends true | false | Operator>(
  value: any,
  type: T
): value is { ")": T };
function isSymbol<T extends "(" | "[" | "]">(
  value: any,
  type: T
): value is { [key in T]: true };
function isSymbol<T extends FunctionName>(
  value: any,
  type: T
): value is Extract<FunctionSymbol, { [key in T]: any }>;
function isSymbol<T extends SymbolKey>(
  value: any,
  type: T
): value is SyntaxStreamSymbol {
  if (isOperator(type)) {
    return isObject(value) && ")" in value && value[")"] === type;
  }
  return isObject(value) && type in value;
}

export function createSyntaxStream(
  tree: SyntaxTree<WithSyntaxError>,
  transformId: <T extends string>(id: T) => DBId<T>
): DBSyntaxStream {
  const flatten = (
    value: SyntaxNode<WithSyntaxError>,
    parent: SyntaxNode<WithSyntaxError> | null
  ): DBSyntaxStream => {
    const flattened: DBSyntaxStream = [];

    value.children.forEach((el) => {
      if (isObject(el) && "children" in el) {
        flattened.push(...flatten(el, value));
      } else if (isObject(el) && "id" in el) {
        // handle branded ids
        flattened.push(addNestedObjectIds([el], transformId)[0]);
      } else if (Array.isArray(el)) {
        // handle branded ids
        flattened.push(addNestedObjectIds(el, transformId));
      } else if (isObject(el) && "error" in el && el.error === ")") {
        flattened.push({ ")": false });
      } else if (isObject(el) && "error" in el) {
        flattened.push(null);
      } else {
        flattened.push(el);
      }
    });

    const isRootAtTop = parent === null && value.type === "root";

    const childIsAddition =
      value.children.length === 1 &&
      isObject(value.children[0]) &&
      "type" in value.children[0] &&
      ["+", "-"].includes(value.children[0].type as string);

    const isAutoBracket =
      childIsAddition &&
      value.type === null &&
      ["*", "/"].includes(parent?.type as string);

    if (!isRootAtTop && !isAutoBracket) {
      let openingBracket: SyntaxStreamSymbol = { "(": true };
      let closingBracket: SyntaxStreamSymbol = { ")": true };

      if (value.type === null) {
        // do nothing
        closingBracket = { ")": true };
      } else if (value.type === "array") {
        openingBracket = { "[": true };
        closingBracket = { "]": true };
      } else if (value.type !== null) {
        closingBracket = { [value.type as "in"]: value.data ?? true };
      }

      flattened.unshift(openingBracket);
      if (!value.open) flattened.push(closingBracket);
    }

    return flattened;
  };

  let result = [...flatten(tree, null)];

  return result;
}

export function parseSyntaxStream(
  stream: SyntaxStream | DBSyntaxStream
): SyntaxTree<WithSyntaxError> {
  let root: SyntaxNode<WithSyntaxError> = { children: [], type: null };

  let hasNestedRoot = false;

  let parents = new WeakMap<
    SyntaxNode<WithSyntaxError>,
    SyntaxNode<WithSyntaxError>
  >();

  let current: SyntaxNode<WithSyntaxError> = root;

  (stream as DBSyntaxStream).forEach((token) => {
    if (isSymbol(token, "(") || isSymbol(token, "[")) {
      // An opening bracket always creates a group with operation null
      // and the operation stays null. So when we enter children groups,
      // we know we can return to the latest bracket group by returning
      // to the parent with operation null.
      const node = { children: [], type: null };
      parents.set(node, current);
      current.children.push(node);
      current = node;
    } else if (isSymbol(token, ")") && token[")"] === false) {
      current.children.push({ error: ")" });
    } else if (isFunctionSymbol(token)) {
      current = returnToNullParent(current, parents);

      const [type, data] = Object.entries(token)[0] as [
        FunctionName,
        FunctionData
      ];

      current.type = type;
      if (data !== true) {
        current.data = data;
      }
      if ("root" in token) {
        hasNestedRoot = true;
      }

      const parent = parents.get(current)!;
      current = parent;
    } else if (isOperatorSymbol(token)) {
      current = returnToNullParent(current, parents);

      const type = Object.keys(token)[0] as Operator;

      if (["/", "*"].includes(type)) {
        current.children = current.children.map((child) => {
          if (
            isObject(child) &&
            "type" in child &&
            ["+", "-"].includes(child.type as string)
          ) {
            return {
              type: null,
              children: [child],
            };
          }
          return child;
        });
      }

      current.type = type;

      current.children = current.children.map((child) => {
        if (isObject(child) && "error" in child && child.error === ",") {
          return { error: "missing" };
        }
        return child;
      });

      const parent = parents.get(current)!;
      current = parent;
    } else if (isSymbol(token, ")") || isSymbol(token, "]")) {
      current = returnToNullParent(current, parents);

      if (isSymbol(token, "]")) {
        current.type = "array";
      }

      const parent = parents.get(current)!;
      current = parent;
    } else if (token === null) {
      // Replaced with { error: "missing" } if we turn out to be in operator.
      // We cannot have erroneous comma in operator.
      current.children.push({ error: "," });
    } else if (isNestedEntityWithDBId(token)) {
      current.children.push(removeNestedObjectIds([token])[0] as any);
    } else if (Array.isArray(token)) {
      current.children.push(removeNestedObjectIds(token));
    } else if (isObject(token) && "n" in token) {
      current.children.push(token);
    } else if (isObject(token) && "x" in token) {
      current.children.push(token);
    } else if (tokens.isToken(token)) {
      current.children.push(token);
    } else {
      // primitive value
      current.children.push(token);
    }
  });

  if (current !== root) {
    let i = 0;
    while (current !== root) {
      if (!operators.includes(current.type as any)) {
        current.open = true;
      }
      current = parents.get(current)!;
      if (!current) {
        throw new Error("Unbalanced brackets");
      }
      i++;
    }
  }

  if (hasNestedRoot) {
    root = root.children[0] as SyntaxTree;
  } else {
    root.type = "root";
  }

  console.log("ROOT", root);

  return root;
}

function removeNestedObjectIds(value: DBSyntaxStream): SyntaxStream;
function removeNestedObjectIds(value: DBValueArray): ValueArray;
function removeNestedObjectIds(
  value: DBSyntaxStream | DBValueArray
): SyntaxStream | ValueArray {
  return (value as DBSyntaxStream).map((el) => {
    if (el === null || typeof el !== "object") return el;
    if (Array.isArray(el)) {
      return removeNestedObjectIds(el);
    }
    if (!("id" in el)) return el;
    return {
      ...el,
      id: unwrapObjectId(el.id),
      ...("field" in el && { field: unwrapObjectId(el.field) }),
      ...("folder" in el && { folder: unwrapObjectId(el.folder) }),
    };
  });
}

export function addNestedObjectIds(
  value: ValueArray,
  transformId: <T extends string>(id: T) => DBId<T>
): DBValueArray;
export function addNestedObjectIds(
  value: SyntaxStream,
  transformId: <T extends string>(id: T) => DBId<T>
): DBSyntaxStream;
export function addNestedObjectIds(
  value: ValueArray | SyntaxStream,
  transformId: <T extends string>(id: T) => DBId<T>
): DBValueArray | DBSyntaxStream {
  return value.map((el) => {
    if (el === null || typeof el !== "object") return el;
    if (Array.isArray(el)) {
      return addNestedObjectIds(el, transformId);
    }
    if (!("id" in el)) return el;
    return {
      ...el,
      id: transformId(el.id),
      ...("field" in el && { field: transformId(el.field) }),
      ...("folder" in el && { folder: transformId(el.folder) }),
    };
  });
}
