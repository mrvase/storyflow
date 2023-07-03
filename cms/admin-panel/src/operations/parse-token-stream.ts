import { operators } from "@storyflow/shared/types";
import type { FunctionName, RawDocumentId } from "@storyflow/shared/types";
import type {
  FieldTransform,
  WithSyntaxError,
  SyntaxNode,
  SyntaxTree,
  NestedField,
  FunctionData,
  FunctionSymbol,
} from "@storyflow/cms/types";
import type { TokenStream, TokenStreamSymbol, HasSelect } from "./types";
import { tokens } from "@storyflow/cms/tokens";
import { isFunctionSymbol, isOperator } from "@storyflow/cms/symbols";
import {
  insertRootInTransforms,
  splitTransformsAndRoot,
} from "@storyflow/cms/transform";
import { isSymbol } from "./is-symbol";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

const isInline = (token: SyntaxNode<WithSyntaxError>["children"][number]) => {
  if (isObject(token) && "id" in token) {
    return Boolean(token.inline);
  }
  if (
    isObject(token) &&
    "type" in token &&
    ["select", "loop"].includes(token.type!)
  ) {
    // syntax node
    return true;
  }
  return (
    typeof token === "string" ||
    typeof token === "number" ||
    tokens.isContextToken(token) ||
    tokens.isStateToken(token) ||
    // tokens.isToken(token) ||
    tokens.isParameter(token)
  );
};

const returnToNullParent = (
  current: SyntaxNode<WithSyntaxError>,
  parents: WeakMap<SyntaxNode<WithSyntaxError>, SyntaxNode<WithSyntaxError>>
) => {
  while (current.type !== null && current.type !== "root") {
    current = parents.get(current)!;
  }
  return current;
};

const isMerge = (
  token: SyntaxNode<WithSyntaxError>["children"][number]
): token is SyntaxNode<WithSyntaxError> => {
  return isObject(token) && "type" in token && token.type === "merge";
};

export function parseTokenStream(
  stream: TokenStream,
  transforms?: FieldTransform[]
): SyntaxTree<WithSyntaxError> {
  let root: SyntaxNode<WithSyntaxError> & { type: "root" } = {
    children: [],
    type: "root",
  };

  let parents = new WeakMap<
    SyntaxNode<WithSyntaxError>,
    SyntaxNode<WithSyntaxError>
  >();

  let current: SyntaxNode<WithSyntaxError> = root;

  const getFormer = () => current.children[current.children.length - 1];

  const mergePush = (
    token: SyntaxNode<WithSyntaxError>["children"][number]
  ) => {
    if (!prevIsComma && current.children.length && isInline(token)) {
      const former = getFormer();
      if (isMerge(former)) {
        former.children.push(token);
        return;
      } else if (isInline(former) && [null, "root"].includes(current.type)) {
        // if current.type is already set, it is an operator, and they have "implicit commas"
        current.children.pop();
        current.children.push({
          type: "merge",
          children: [former, token],
        });
        return;
      }
    }
    if (prevIsComma && !isInline(token)) {
      current.children.push({ error: "," });
    }
    current.children.push(token);
  };

  let prevIsComma = false;
  let prevIsOperator = false;

  const isWrongComma = () => {
    const former = getFormer();
    return (
      current.children.length === 0 || !(isInline(former) || isMerge(former))
    );
  };

  stream.forEach((token) => {
    let currentIsComma = false;

    if (isSymbol(token, "(") || isSymbol(token, "[")) {
      // An opening bracket always creates a group with operation null
      // and the operation stays null. So when we enter children groups,
      // we know we can return to the latest bracket group by returning
      // to the parent with operation null.
      const node = { children: [], type: null };
      parents.set(node, current);
      mergePush(node);
      current = node;
    } else if (isFunctionSymbol(token)) {
      // we first return to the level introduced by the opening bracket
      // (see comment above)
      current = returnToNullParent(current, parents);

      if (prevIsComma) {
        current.children.push({ error: "," });
      }

      const [type, data] = Object.entries(token)[0] as [
        FunctionName,
        FunctionData
      ];

      current.type = type;
      if (data !== true) {
        current.data = data;
      }

      // and then return to the parent that the bracket group was originally pushed to
      const parent = parents.get(current);
      if (!parent) {
        // TODO: Should be function name??
        current.children.push({ error: ")" });
      } else {
        current = parent;
      }
    } else if (isSymbol(token, ")") || isSymbol(token, "]")) {
      // we first return to the level introduced by the opening bracket
      // (see comment above)

      current = returnToNullParent(current, parents);

      if (prevIsComma) {
        current.children.push({ error: "," });
      }

      if ((token as any)[")"] && typeof (token as any)[")"] !== "boolean") {
        // operator
        current.type = (token as any)[")"];
      } else if ((token as any)["]"]) {
        current.type = "array";
      }

      // and then return to the parent that the bracket group was originally pushed to
      const parent = parents.get(current);
      if (!parent) {
        // ERROR
        current.children.push({ error: ")" });
      } else {
        current = parent;
      }
    } else if (isSymbol(token, ",")) {
      // the only case in which we are in a group where the operation is not null
      // is when it has been set to an operator (and not a function name - these are only added when the group is left).
      // Since there cannot be a comma or an n in a group with an operator, we return to the parent.
      current = returnToNullParent(current, parents);

      const commaIsWrong = isWrongComma();

      if (prevIsComma || commaIsWrong) {
        // ERROR
        current.children.push({ error: "," });
      }

      // if prevIsComma: we add error to say the PREVIOUS COMMA is wrong
      // if commaIsWrong: we add error to say the CURRENT COMMA is wrong
      // in the latter case, we do not want to add an error again, because it is registered as a wrong PREVIOUS comma
      // So we only say "prevIsComma" is true if an error has not already been added here.
      // Therefore currentIsComma = !commaIsWrong below.
      currentIsComma = !commaIsWrong;
    } else if (tokens.isLineBreak(token)) {
      // see comment above
      current = returnToNullParent(current, parents);
      if (prevIsComma) {
        current.children.push({ error: "," });
      }
      current.children.push(token);
    } else if (isSymbol(token, "_")) {
      if (current.type !== token["_"]) {
        if (
          ["+", "-"].includes(token["_"]) &&
          ["*", "/"].includes(current.type as string)
        ) {
          /*
          ASSUMPTION: we know that the current has a parent, since root always has operation === null.
          The multiplication should be nested in the addition, since it takes priority.
          SWAP: So the addition takes the place of the multiplication in the parent array, and the
          multiplication becomes a child of the addition.
          */
          const swapIndex = parents
            .get(current)!
            .children.findIndex((child) => child === current);
          const parent = parents.get(current)!;
          const node: SyntaxNode<WithSyntaxError> = {
            children: [current],
            type: token["_"],
          };
          parents.set(current, node);
          parents.set(node, parent);
          parent.children[swapIndex] = node;
          current = node;
        } else {
          let last;
          if (current.children.length === 0) {
            last = { error: "missing" as "missing" };
          } else if (
            current.children.length === 1 &&
            current.type !== null &&
            current.type !== "root"
          ) {
            // maybe this should not be a special case and do the same as the else below
          } else {
            last = current.children[current.children.length - 1];
            current.children.pop();
          }

          const node: SyntaxNode<WithSyntaxError> = {
            children: last !== undefined ? [last] : [],
            type: token["_"],
          };
          parents.set(node, current);
          current.children.push(node);
          current = node;
        }
      } else {
        if (prevIsOperator) {
          // ERROR
          current.children.push({ error: "missing" });
        }
        // nothing
      }
    } else if (tokens.isNestedField(token)) {
      if ("select" in token) {
        let { select, ...rest } = token;
        let loop: RawDocumentId | undefined;
        if ("loop" in token) ({ loop, ...rest } = rest);
        let node: SyntaxNode<WithSyntaxError> = {
          children: [rest],
          type: "select",
          data: select,
        };
        if (loop) {
          node = {
            children: [node],
            type: "loop",
            data: loop,
          };
        }
        parents.set(node, current);
        mergePush(node);
      } else {
        mergePush(token);
      }
    } else if (
      tokens.isNestedDocument(token) ||
      tokens.isNestedFolder(token) ||
      tokens.isNestedElement(token)
    ) {
      mergePush(token);
    } else if (tokens.isToken(token)) {
      mergePush(token);
    } else if (tokens.isParameter(token)) {
      mergePush(token);
    } else if (tokens.isLineBreak(token)) {
      // do nothing
    } else if (Array.isArray(token)) {
      // ??
    } else {
      mergePush(token);
    }

    prevIsOperator = isSymbol(token, "_");
    prevIsComma = currentIsComma;
  });

  if (prevIsComma) {
    current.children.push({ error: "," });
  }

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

  if (transforms) {
    return insertRootInTransforms(root, transforms);
  }

  return root;
}

export function createTokenStream(
  tree: SyntaxTree<WithSyntaxError>
): TokenStream {
  tree = splitTransformsAndRoot(tree)[1];

  const flatten = (
    value: SyntaxNode<WithSyntaxError>,
    parent: SyntaxNode<WithSyntaxError> | null
  ) => {
    let flattened: TokenStream = [];

    let symbol: TokenStreamSymbol | undefined;

    if (isOperator(value.type)) {
      symbol = { _: value.type as (typeof operators)[number] };
    }

    const isSeparable = (
      current: SyntaxNode<WithSyntaxError>["children"][number]
    ) => {
      return isInline(current) || isMerge(current);
    };

    const addComma = (
      current: SyntaxNode<WithSyntaxError>["children"][number],
      prev: SyntaxNode<WithSyntaxError>["children"][number] | undefined
    ) => {
      return (
        prev !== undefined &&
        value.type !== "merge" &&
        !symbol &&
        isSeparable(current) &&
        isSeparable(prev)
      );
    };

    value.children.forEach((el, index) => {
      if (index && symbol) {
        flattened.push(symbol);
      }
      const prev = value.children[index - 1];
      const next = value.children[index + 1];
      if (isObject(el) && "children" in el) {
        if (addComma(el, prev)) {
          flattened.push({ ",": true });
        }
        flattened.push(...flatten(el, value));
      } else if (isObject(el) && "error" in el && el.error === ")") {
        flattened.push({ ")": true });
      } else if (isObject(el) && "error" in el) {
        if (el.error === "missing") {
          if (
            prev &&
            !(isObject(prev) && "error" in prev && prev.error === "missing") &&
            !next
          ) {
            flattened.push(symbol!);
          }
        } else {
          flattened.push({ ",": true });
        }
      } else {
        if (addComma(el, prev)) {
          flattened.push({ ",": true });
        }
        flattened.push(el);
      }
    });

    if (value.children.length <= 1 && symbol) {
      flattened.push(symbol);
    }

    const isRootAtTop = parent === null && value.type === "root";

    if (isOperator(value.type)) {
      // do nothing - handled above
    } else if (isRootAtTop) {
      // do nothing
    } else if (value.type === "merge") {
      // do nothing
    } else if (value.type === "select") {
      (flattened[0] as HasSelect<NestedField>).select = value.data;
    } else if (value.type === "loop") {
      (flattened[0] as HasSelect<NestedField>).loop = value.data;
    } else {
      let openingBracket: TokenStreamSymbol = { "(": true };
      let closingBracket: TokenStreamSymbol = { ")": true };

      if (value.type === "array") {
        openingBracket = { "[": true };
        closingBracket = { "]": true };
      } else if (value.type !== null) {
        closingBracket = { [value.type]: value.data ?? true } as FunctionSymbol;
      }

      flattened.unshift(openingBracket);
      if (!value.open) flattened.push(closingBracket);
    }

    return flattened;
  };

  let result = [...flatten(tree, null)];

  return result;
}
