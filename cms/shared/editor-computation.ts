import {
  Token,
  Computation,
  EditorComputation,
  FunctionName,
  Operator,
  Placeholder,
  Value,
  DBSymbol,
  EditorSymbol,
  RawFieldId,
} from "@storyflow/backend/types";
import { tools } from "./editor-tools";

type DBElement = Computation[number];
type EditorElement = EditorComputation[number];

type GroupedEditorElement =
  | EditorElement
  | { group: GroupedEditorElement[]; type: string };

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object";
}

const isSymbol = (
  el: DBElement | EditorElement
): el is DBSymbol | EditorSymbol => {
  if (!isObject(el)) return false;
  const keys = Object.keys(el);
  return keys.length === 1 && keys[0].length === 1;
};

const isValueOrPlaceholder = (
  el: DBElement | EditorElement
): el is Exclude<Value, Value[]> | Placeholder => {
  return !isSymbol(el);
};

const isSeparator = <T extends "," | "n" = "," | "n">(
  el: any,
  specify?: T
): el is { [key in T]: true } => {
  if (!isSymbol(el)) return false;
  const key = Object.keys(el)[0];
  return (key === "," && specify !== "n") || (key === "n" && specify !== ",");
};

const isNonMergeable = (
  el:
    | DbFunction
    | Value
    | Placeholder
    | { ",": true }
    | { "/": true }
    | { n: true }
    | Token
) => {
  // non-mergeables are nested documents, document imoports, and fetchers.
  return (
    isObject(el) &&
    ("dref" in el || ("id" in el && "values" in el) || "filters" in el)
  );
};

const isMergeBreaker = (el: any) => isSeparator(el, ",") || isNonMergeable(el);

const addTransform = (
  db: Computation,
  transform: FunctionName
): Computation => {
  return [{ "(": true }, ...db, { ")": transform }];
};

const removeTransform = (
  db: Computation,
  transform: FunctionName
): Computation => {
  return db.slice(1, -1);
};

export const encodeEditorComputation = (
  _db: Computation,
  transform?: FunctionName
) => {
  let db = _db;
  if (transform) {
    db = removeTransform(db, transform);
  }

  let value: GroupedEditorElement[] = [];
  let stack: GroupedEditorElement[][] = [];

  const replaceSeparators = (
    arr: GroupedEditorElement[],
    value?: { _: Operator }
  ) => {
    return arr.reduce((acc, el, i) => {
      if (isSeparator(el, ",")) {
        if (!value) return acc;
        return acc.concat([value]);
      } else if (i > 0 && !isSeparator(arr[i - 1], ",")) {
        if (!value) return acc.concat([el]);
        return acc.concat([value, el]);
      } else {
        return acc.concat([el]);
      }
    }, [] as GroupedEditorElement[]);
  };

  const prevIsValueOrPlaceholder = (arr: GroupedEditorElement[]) => {
    if (arr.length === 0) return false;
    const prev = arr[arr.length - 1];
    return (isObject(prev) && "group" in prev) || isValueOrPlaceholder(prev);
  };

  const flatten = (
    value: GroupedEditorElement[],
    parentOperator?: string
  ): EditorElement[] => {
    const flattened: EditorElement[] = [];
    value.forEach((el) => {
      if (isObject(el) && "group" in el) {
        const nestedAddition =
          ["*", "/"].includes(parentOperator as string) &&
          ["+", "-"].includes(el.type);
        if (nestedAddition || el.type === "bracket") {
          flattened.push({ "(": true });
        }
        flattened.push(...flatten(el.group, el.type));
        if (nestedAddition || el.type === "bracket") {
          flattened.push({ ")": true });
        }
      } else {
        flattened.push(el);
      }
    });

    return flattened;
  };

  db.forEach((el) => {
    if (tools.isDBSymbol(el, "(") || tools.isDBSymbol(el, "{")) {
      stack.push(value);
      value = [];
    } else if (
      tools.isDBSymbol(el, ")", "+") ||
      tools.isDBSymbol(el, ")", "-") ||
      tools.isDBSymbol(el, ")", "*") ||
      tools.isDBSymbol(el, ")", "/")
    ) {
      const saved = stack[stack.length - 1];
      if (prevIsValueOrPlaceholder(saved)) {
        // inserts separator between operations
        saved.push({ ",": true });
      }

      const operator = el[")"];
      const symbol = { _: operator };

      let group = replaceSeparators(value, symbol).filter((el) => el !== null);

      // edge cases
      /*
      if (group[0] === null) {
        group.shift();
      } else if (group.length === 1) {
        group.push(symbol);
      }
      */

      saved.push({
        group,
        type: operator,
      });
      value = saved;
      stack.pop();
    } else if (tools.isDBSymbol(el, "p")) {
      const saved = stack[stack.length - 1];
      if (prevIsValueOrPlaceholder(saved)) {
        saved.push({ ",": true });
      }
      if (value.length === 1 && tools.isNestedField(value[0])) {
        const fieldImport = { ...value[0] };
        fieldImport.pick = el.p;
        saved.push(fieldImport);
      } else {
        let group = value;
        saved.push({ group, type: "bracket" }); // TODO: Should be function!
      }
      value = saved;
      stack.pop();
    } else if (tools.isDBSymbol(el, "}")) {
      const saved = stack[stack.length - 1];
      saved.push(...replaceSeparators(value));
      value = saved;
      stack.pop();
    } else if (tools.isDBSymbol(el, ")")) {
      const saved = stack[stack.length - 1];
      if (prevIsValueOrPlaceholder(saved)) {
        // inserts separator between operations
        saved.push({ ",": true });
      }
      saved.push({
        group: value.filter((el) => el !== null),
        type: "bracket",
      });
      value = saved;
      stack.pop();
    } else {
      const prev = value[value.length - 1];
      if (
        typeof prev !== "undefined" &&
        !tools.isDBSymbol(prev, "n") &&
        !tools.isDBSymbol(el, "n") &&
        !isMergeBreaker(prev) &&
        !isMergeBreaker(el)
      ) {
        value.push({ ",": true });
      }
      if (tools.isNestedField(el)) {
        value.push(el);
      } else if (isValueOrPlaceholder(el)) {
        value.push(el);
      } else if (tools.isDBSymbol(el, "n")) {
        value.push(el);
      } else if (tools.isDBSymbol(el, "/")) {
        value.push({ n: true });
      } else if (tools.isFileToken(el)) {
        value.push(el);
      } else if (tools.isColorToken(el)) {
        value.push(el);
      } else if (tools.isCustomToken(el)) {
        value.push(el);
      } else if (tools.isParameter(el)) {
        value.push(el);
      }
    }
  });

  return flatten(value.filter((el) => el !== null));
};

type DbFunction = {
  parameters: (
    | DbFunction
    | Exclude<Value, Value[]>
    | Placeholder
    | { ",": true }
    | { n: true }
    | { "/": true }
    | Token
  )[];
  operation: string | null;
  parent: DbFunction | null;
  pick?: RawFieldId;
};

export const decodeEditorComputation = (
  client: EditorElement[],
  transform?: FunctionName
) => {
  let value: DbFunction = { parameters: [], operation: null, parent: null };
  let current: DbFunction = value;

  client.forEach((el, index) => {
    if (tools.isEditorSymbol(el, "(")) {
      // An opening bracket always creates a group with operation null
      // and the operation stays null. So when we enter children groups,
      // we know we can return to the latest bracket group by returning
      // to the parent with operation null.
      const func = { parameters: [], operation: null, parent: current };
      current.parameters.push(func);
      current = func;
    } else if (tools.isEditorSymbol(el, ")")) {
      // we first return to the level introduced by the opening bracket
      // (see comment above)
      while (current.operation !== null) {
        current = current.parent!;
      }
      // and then return to the parent that the bracket group was originally pushed to
      current = current.parent!;
    } else if (tools.isEditorSymbol(el, ",") || tools.isEditorSymbol(el, "n")) {
      // the only case in which we are in a group where the operation is not null
      // is when it has been set to an operator (and not a function name - these are only added when the group is left).
      // Since there cannot be a comma or an n in a group with an operator, we return to the parent.
      while (current.operation !== null) {
        current = current.parent!;
      }
      current.parameters.push(el);
    } else if (
      tools.isEditorSymbol(el, "+") ||
      tools.isEditorSymbol(el, "-") ||
      tools.isEditorSymbol(el, "*") ||
      tools.isEditorSymbol(el, "/")
    ) {
      if (current.operation !== el["_"]) {
        if (
          ["+", "-"].includes(el["_"]) &&
          ["*", "/"].includes(current.operation as string)
        ) {
          /*
          ASSUMPTION: we know that the current has a parent, since root always has operation === null.
          The multiplication should be nested in the addition, since it takes priority.
          SWAP: So the addition takes the place of the multiplication in the parent array, and the
          multiplication becomes a parameter of the addition.
          */
          const swapIndex = current.parent!.parameters.findIndex(
            (el) => el === current
          );
          const func: DbFunction = {
            parameters: [current, { ",": true }],
            operation: el["_"],
            parent: current.parent,
          };
          current.parent!.parameters[swapIndex] = func;
          current = func;
        } else {
          const last = current.parameters[current.parameters.length - 1];
          current.parameters.pop();
          const func: DbFunction = {
            parameters: [last ?? null, { ",": true }],
            operation: el["_"],
            parent: current,
          };
          current.parameters.push(func);
          current = func;
        }
      } else {
        current.parameters.push({ ",": true });
      }
    } else if (tools.isNestedField(el)) {
      if ("pick" in el) {
        let { pick, ...rest } = el;
        current.parameters.push({
          parameters: [rest],
          operation: "pick",
          parent: current,
          pick,
        });
      } else {
        current.parameters.push(el);
      }
    } else if (tools.isFileToken(el)) {
      current.parameters.push(el);
    } else if (tools.isColorToken(el)) {
      current.parameters.push(el);
    } else if (tools.isCustomToken(el)) {
      current.parameters.push(el);
    } else if (tools.isParameter(el)) {
      current.parameters.push(el);
    } else if (isValueOrPlaceholder(el)) {
      current.parameters.push(el);
    }
  });

  const getMergeableSpans = (
    params: (
      | DbFunction
      | Value
      | Placeholder
      | { ",": true }
      | { "/": true }
      | { n: true }
      | Token
    )[]
  ) => {
    const mergeableSpans: [number, number][] = [];
    let i = 0;
    let lastEnd = -1;
    while (i < params.length) {
      const el = params[i];
      if (!isMergeBreaker(el)) {
        let start = i;
        while (start - 1 > lastEnd && !isMergeBreaker(params[start - 1])) {
          start -= 1;
        }
        let end = i;
        while (end + 1 < params.length && !isMergeBreaker(params[end + 1])) {
          end += 1;
        }
        if (start !== end) {
          mergeableSpans.unshift([start, end]);
        }
        lastEnd = i;
        i = end + 1;
      }
      i++;
    }
    return mergeableSpans;
  };

  const flatten = (value: DbFunction): DBElement[] => {
    if (value.operation !== "merge") {
      const mergeableSpans = getMergeableSpans(value.parameters);
      if (mergeableSpans.length > 0) {
        // wrap spans in merge operations
        mergeableSpans.forEach(([start, end]) => {
          const removed = value.parameters.splice(start, end - start + 1);
          value.parameters.splice(start, 0, {
            parameters: removed.map((el) =>
              isObject(el) && "n" in el ? { "/": true } : el
            ),
            operation: "merge",
            parent: value,
          });
        });
      }
    }

    const flattened: DBElement[] = [];

    value.parameters.forEach((el, index) => {
      if (isObject(el) && "parameters" in el) {
        flattened.push(...flatten(el));
      } else if (isSeparator(el, ",")) {
        if (index === 0) {
          flattened.push(null as any);
        }

        const prev = value.parameters[index - 1];
        const next = value.parameters[index + 1];
        if (isSeparator(prev, ",")) {
          flattened.push(null as any);
        }

        if (index === value.parameters.length - 1) {
          flattened.push(null as any);
        }

        if (isNonMergeable(prev)) {
          flattened.push(null as any);
        }
        if (isNonMergeable(next)) {
          flattened.push(null as any);
        }
        // else do nothing
      } else {
        flattened.push(el);
      }
    });

    const isRoot = value.parent === null;

    const childIsAddition =
      value.parameters.length === 1 &&
      isObject(value.parameters[0]) &&
      "operation" in value.parameters[0] &&
      ["+", "-"].includes(value.parameters[0].operation as string);

    const isAutoBracket =
      childIsAddition &&
      value.operation === null &&
      ["*", "/"].includes(value.parent?.operation as string);

    if (!isRoot && !isAutoBracket) {
      let openingBracket: Computation[number] = { "(": true };
      let closingBracket: Computation[number] = { ")": true };

      if (value.operation === "merge") {
        openingBracket = { "{": true };
        closingBracket = { "}": true };
      } else if (value.operation === "pick") {
        closingBracket = { p: value.pick! };
      } else if (value.operation !== null) {
        closingBracket = { ")": value.operation as "+" };
      }

      flattened.unshift(openingBracket);
      flattened.push(closingBracket);
    }

    return flattened;
  };

  let result = [...flatten(value)];
  if (transform) {
    result = addTransform(result, transform);
  }
  return result;
};
