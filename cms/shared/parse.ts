import {
  FunctionName,
  functions,
  NestedField,
  operators,
} from "@storyflow/backend/types";
import {
  SyntaxNode,
  DBSyntaxStream,
  SyntaxTree,
  TokenStream,
  WithSyntaxError,
  DBOperativeToken,
  OperativeToken,
} from "@storyflow/backend/types2";
import { symb } from "@storyflow/backend/symb";

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

const isInline = (token: SyntaxNode<WithSyntaxError>["children"][number]) => {
  if (typeof token !== "object") return true;
  if ("id" in token) {
    return Boolean(token.inline);
  }
  if ("type" in token) {
    return true;
  }
  return (
    symb.isPrimitiveValue(token) ||
    symb.isToken(token) ||
    symb.isParameter(token)
  );
};

const isMerge = (
  token: SyntaxNode<WithSyntaxError>["children"][number]
): token is SyntaxNode<WithSyntaxError> => {
  return isObject(token) && "type" in token && token.type === "merge";
};

const returnToNullParent = (
  current: SyntaxNode<WithSyntaxError>,
  parents: WeakMap<SyntaxNode<WithSyntaxError>, SyntaxNode<WithSyntaxError>>
) => {
  while (current.type !== null) {
    current = parents.get(current)!;
  }
  return current;
};

export function parseTokenStream(
  stream: TokenStream,
  transform?: FunctionName
): SyntaxTree<WithSyntaxError> {
  let root: SyntaxNode<WithSyntaxError> = { children: [], type: null };

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
      } else if (isInline(former) && !current.type) {
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

    if (symb.isEditorSymbol(token, "(") || symb.isEditorSymbol(token, "[")) {
      // An opening bracket always creates a group with operation null
      // and the operation stays null. So when we enter children groups,
      // we know we can return to the latest bracket group by returning
      // to the parent with operation null.
      const node = { children: [], type: null };
      parents.set(node, current);
      mergePush(node);
      current = node;
    } else if (
      symb.isEditorSymbol(token, ")") ||
      symb.isEditorSymbol(token, "]")
    ) {
      // we first return to the level introduced by the opening bracket
      // (see comment above)

      current = returnToNullParent(current, parents);

      if (prevIsComma) {
        current.children.push({ error: "," });
      }

      if (typeof token[")"] === "string") {
        current.type = token[")"];
      }

      // and then return to the parent that the bracket group was originally pushed to
      const parent = parents.get(current);
      if (!parent) {
        // ERROR
        current.children.push({ error: ")" });
      } else {
        current = parent;
      }
    } else if (symb.isEditorSymbol(token, ",")) {
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
    } else if (symb.isEditorSymbol(token, "n")) {
      // see comment above
      current = returnToNullParent(current, parents);
      if (prevIsComma) {
        current.children.push({ error: "," });
      }
      current.children.push(token);
    } else if (
      symb.isEditorSymbol(token, "+") ||
      symb.isEditorSymbol(token, "-") ||
      symb.isEditorSymbol(token, "*") ||
      symb.isEditorSymbol(token, "/")
    ) {
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
            last = { missing: "number" };
          } else if (current.children.length === 1 && current.type !== null) {
            // maybe this should not be a special case and do the same as the else below
          } else {
            last = current.children[current.children.length - 1];
            current.children.pop();
          }

          const node: SyntaxNode<WithSyntaxError> = {
            children: last ? [last] : [],
            type: token["_"],
          };
          parents.set(node, current);
          current.children.push(node);
          current = node;
        }
      } else {
        if (prevIsOperator) {
          // ERROR
          current.children.push({ missing: "number" });
        }
        // nothing
      }
    } else if (symb.isNestedField(token)) {
      if ("pick" in token) {
        let { pick, ...rest } = token;
        const node: SyntaxNode<WithSyntaxError> = {
          children: [rest],
          type: "pick",
          payload: {
            pick,
          },
        };
        parents.set(node, current);
        mergePush(node);
      } else {
        mergePush(token);
      }
    } else if (
      symb.isNestedDocument(token) ||
      symb.isNestedFolder(token) ||
      symb.isNestedElement(token)
    ) {
      mergePush(token);
    } else if (symb.isToken(token)) {
      mergePush(token);
    } else if (symb.isParameter(token)) {
      mergePush(token);
    } else if (symb.isPrimitiveValue(token)) {
      mergePush(token);
    }

    prevIsOperator = symb.isEditorSymbol(token, "_");
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

  return root;
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
        flattened.push(el);
      } else if (isObject(el) && "error" in el && el.error === ")") {
        flattened.push({ ")": false });
      } else if (isObject(el) && "error" in el) {
        flattened.push(null as any);
      } else if (isObject(el) && "missing" in el) {
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
      let openingBracket: DBOperativeToken = { "(": true };
      let closingBracket: DBOperativeToken = { ")": true };

      if (value.type === "merge") {
        openingBracket = { "{": true };
        closingBracket = { "}": true };
      } else if (value.type === "pick") {
        closingBracket = { p: value.payload!.pick };
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
  stream: DBSyntaxStream
): SyntaxTree<WithSyntaxError> {
  let root: SyntaxNode<WithSyntaxError> = { children: [], type: null };

  let parents = new WeakMap<
    SyntaxNode<WithSyntaxError>,
    SyntaxNode<WithSyntaxError>
  >();

  let current: SyntaxNode<WithSyntaxError> = root;

  stream.forEach((token) => {
    if (symb.isDBSymbol(token, "(") || symb.isDBSymbol(token, "{")) {
      // An opening bracket always creates a group with operation null
      // and the operation stays null. So when we enter children groups,
      // we know we can return to the latest bracket group by returning
      // to the parent with operation null.
      const node = { children: [], type: null };
      parents.set(node, current);
      current.children.push(node);
      current = node;
    } else if (symb.isDBSymbol(token, ")") && token[")"] === false) {
      current.children.push({ error: ")" });
    } else if (symb.isDBSymbol(token, ")") || symb.isDBSymbol(token, "}")) {
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
            return { missing: "number" };
          }
          return child;
        });
      }

      if (typeof token[")"] === "string") {
        current.type = token[")"];
      } else if (symb.isDBSymbol(token, "}")) {
        current.type = "merge";
      }

      const parent = parents.get(current)!;
      current = parent;
    } else if (symb.isDBSymbol(token, "n")) {
      current.children.push(token);
    } else if (symb.isDBSymbol(token, "p")) {
      current.type = "pick";
      current.payload = { pick: token.p };
      current = returnToNullParent(current, parents);
    } else if (token === null) {
      // Replaced with { missing: "number" } if we turn out to be in operator.
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

export function createTokenStream(
  tree: SyntaxTree<WithSyntaxError>
): TokenStream {
  const flatten = (
    value: SyntaxNode<WithSyntaxError>,
    parent: SyntaxNode<WithSyntaxError> | null
  ) => {
    let flattened: TokenStream = [];

    let symbol;

    if (operators.includes(value.type as any)) {
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
        flattened.push({ ",": true });
      } else if (isObject(el) && "missing" in el) {
        if (prev && !(isObject(prev) && "missing" in prev) && !next) {
          flattened.push(symbol);
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

    const isRoot = parent === null;

    if (operators.includes(value.type as any)) {
    } else if (value.type === "merge") {
    } else if (value.type === "pick") {
      (flattened[0] as NestedField).pick = value.payload!.pick;
    } else if (!isRoot) {
      let openingBracket: OperativeToken = { "(": true };
      let closingBracket: OperativeToken = { ")": true };

      if (value.type !== null) {
        closingBracket = { ")": value.type as (typeof functions)[number] };
      }

      flattened.unshift(openingBracket);
      if (!value.open) flattened.push(closingBracket);
    }

    return flattened;
  };

  let result = [...flatten(tree, null)];

  return result;
}
