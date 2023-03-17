import {
  operators,
  SyntaxNode,
  DBSyntaxStream,
  SyntaxTree,
  WithSyntaxError,
  SyntaxStream,
  SyntaxStreamSymbol,
  HasDBId,
  Operator,
  FunctionName,
  RawFieldId,
} from "@storyflow/backend/types2";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

const returnToNullParent = (
  current: SyntaxNode<WithSyntaxError>,
  parents: WeakMap<SyntaxNode<WithSyntaxError>, SyntaxNode<WithSyntaxError>>
) => {
  while (current.type !== null) {
    current = parents.get(current)!;
  }
  return current;
};

type KeysOfUnion<T> = T extends T ? keyof T : never;
type SymbolKey = KeysOfUnion<SyntaxStreamSymbol>;

function isSymbol<T extends SymbolKey>(
  value: any,
  key: "p"
): value is { p: RawFieldId };
function isSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  key: T
): value is { ")": true | false | F };
function isSymbol<T extends SymbolKey>(
  value: any,
  key: T
): value is { [key in T]: true };
function isSymbol<T extends ")", F extends Operator | FunctionName>(
  value: any,
  key: T,
  func: F
): value is { ")": F };
function isSymbol<T extends SymbolKey, F extends Operator | FunctionName>(
  value: any,
  key: T,
  func?: F
): value is SyntaxStreamSymbol {
  return isObject(value) && key in value && (!func || value[key] === func);
}

export function createSyntaxStream(
  tree: SyntaxTree<WithSyntaxError>
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
        flattened.push(el as unknown as HasDBId<typeof el>);
      } else if (isObject(el) && "error" in el && el.error === ")") {
        flattened.push({ ")": false });
      } else if (isObject(el) && "error" in el) {
        flattened.push(null as any);
      } else {
        flattened.push(el);
      }
    });

    const isRoot = parent === null;

    const childIsAddition =
      value.children.length === 1 &&
      isObject(value.children[0]) &&
      "type" in value.children[0] &&
      ["+", "-"].includes(value.children[0].type as string);

    const isAutoBracket =
      childIsAddition &&
      value.type === null &&
      ["*", "/"].includes(parent?.type as string);

    if (!isRoot && !isAutoBracket) {
      let openingBracket: SyntaxStreamSymbol = { "(": true };
      let closingBracket: SyntaxStreamSymbol = { ")": true };

      if (value.type === "merge") {
        openingBracket = { "{": true };
        closingBracket = { "}": true };
      } else if (value.type === "array") {
        openingBracket = { "[": true };
        closingBracket = { "]": true };
      } else if (value.type === "select") {
        closingBracket = { p: value.payload!.select };
      } else if (value.type !== null) {
        closingBracket = { ")": value.type as "+" };
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

  let parents = new WeakMap<
    SyntaxNode<WithSyntaxError>,
    SyntaxNode<WithSyntaxError>
  >();

  let current: SyntaxNode<WithSyntaxError> = root;

  (stream as DBSyntaxStream).forEach((token) => {
    if (isSymbol(token, "(") || isSymbol(token, "{") || isSymbol(token, "[")) {
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
    } else if (
      isSymbol(token, ")") ||
      isSymbol(token, "}") ||
      isSymbol(token, "]")
    ) {
      current = returnToNullParent(current, parents);

      // auto bracket
      if (["/", "*"].includes(token[")"])) {
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

      if (operators.includes(token[")"])) {
        current.children = current.children.map((child) => {
          if (isObject(child) && "error" in child && child.error === ",") {
            return { error: "missing" };
          }
          return child;
        });
      }

      if (token[")"] && typeof token[")"] !== "boolean") {
        current.type = token[")"];
      } else if (isSymbol(token, "]")) {
        current.type = "array";
      } else if (isSymbol(token, "}")) {
        current.type = "merge";
      }

      const parent = parents.get(current)!;
      current = parent;
    } else if (isSymbol(token, "p")) {
      current.type = "select";
      current.payload = { select: token.p };
      current = returnToNullParent(current, parents);
    } else if (token === null) {
      // Replaced with { error: "missing" } if we turn out to be in operator.
      // We cannot have erroneous comma in operator.
      current.children.push({ error: "," });
    } else {
      current.children.push(token as any);
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

  return root;
}
