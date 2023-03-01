import {
  Token,
  Computation,
  EditorComputation,
  FunctionName,
  Operator,
  Placeholder,
  TemplateFieldId,
  Value,
  DBSymbol,
  EditorSymbol,
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
): el is Value | Placeholder => {
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
        if (nestedAddition || el.type === "paren") {
          flattened.push({ "(": true });
        }
        flattened.push(...flatten(el.group, el.type));
        if (nestedAddition || el.type === "paren") {
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
      if (value.length === 1 && tools.isFieldImport(value[0])) {
        const fieldImport = { ...value[0] };
        fieldImport.pick = el.p;
        saved.push(fieldImport);
      } else {
        let group = value;
        saved.push({ group, type: "paren" }); // TODO: Should be function!
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
        type: "paren",
      });
      value = saved;
      stack.pop();
    } else {
      const prev = value[value.length - 1];
      if (
        typeof prev !== "undefined" &&
        !tools.isDBSymbol(prev, "n") &&
        !tools.isDBSymbol(el, "n")
      ) {
        value.push({ ",": true });
      }
      if (tools.isFieldImport(el)) {
        value.push(el);
      } else if (isValueOrPlaceholder(el)) {
        value.push(el);
      } else if (tools.isDBSymbol(el, "n")) {
        value.push(el);
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
    | Value
    | Placeholder
    | { ",": true }
    | { n: true }
    | Token
  )[];
  operation: string | null;
  parent: DbFunction | null;
  pick?: TemplateFieldId;
};

export const decodeEditorComputation = (
  client: EditorElement[],
  transform?: FunctionName
) => {
  let value: DbFunction = { parameters: [], operation: null, parent: null };
  let current: DbFunction = value;

  client.forEach((el, index) => {
    if (tools.isSymbol(el, "(")) {
      const func = { parameters: [], operation: null, parent: current };
      current.parameters.push(func);
      current = func;
    } else if (tools.isSymbol(el, ")")) {
      while (current.operation !== null) {
        // we need to first return to the level introduced by the matching parenthesis
        current = current.parent!;
      }
      // and then go to the parent
      current = current.parent!;
    } else if (tools.isSymbol(el, ",") || tools.isSymbol(el, "n")) {
      while (current.operation !== null) {
        current = current.parent!;
      }
      current.parameters.push(el);
    } else if (
      tools.isSymbol(el, "+") ||
      tools.isSymbol(el, "-") ||
      tools.isSymbol(el, "*") ||
      tools.isSymbol(el, "/")
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
    } else if (tools.isFieldImport(el)) {
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
      | { n: true }
      | Token
    )[]
  ) => {
    const mergeableSpans: [number, number][] = [];
    let i = 0;
    let lastEnd = -1;
    while (i < params.length) {
      const el = params[i];
      if (!isSeparator(el)) {
        let start = i;
        while (start - 1 > lastEnd && !isSeparator(params[start - 1])) {
          start -= 1;
        }
        let end = i;
        while (end + 1 < params.length && !isSeparator(params[end + 1])) {
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
        mergeableSpans.forEach(([start, end]) => {
          const removed = value.parameters.splice(start, end - start + 1);
          value.parameters.splice(start, 0, {
            parameters: removed,
            operation: "merge",
            parent: value,
          });
        });
      }
    }

    const flattened: DBElement[] = [];
    const isRoot = value.parent === null;

    const childIsAddition =
      value.parameters.length === 1 &&
      isObject(value.parameters[0]) &&
      "operation" in value.parameters[0] &&
      ["+", "-"].includes(value.parameters[0].operation as string);

    const isAutoParen =
      childIsAddition &&
      value.operation === null &&
      ["*", "/"].includes(value.parent?.operation as string);

    if (!isRoot && !isAutoParen) {
      if (value.operation === "merge") {
        flattened.push({ "{": true });
      } else {
        flattened.push({ "(": true });
      }
    }

    value.parameters.forEach((el, index) => {
      if (isObject(el) && "parameters" in el) {
        flattened.push(...flatten(el));
      } else if (isSeparator(el, ",")) {
        if (index === 0) {
          flattened.push(null as any);
        } else if (isSeparator(value.parameters[index - 1], ",")) {
          flattened.push(null as any);
        }
        if (index === value.parameters.length - 1) {
          flattened.push(null as any);
        }
        // else do nothing
      } else {
        flattened.push(el);
      }
    });

    if (!isRoot && !isAutoParen) {
      if (value.operation === "merge") {
        flattened.push({ "}": true });
      } else if (value.operation === "pick") {
        flattened.push({ p: value.pick! });
      } else if (value.operation !== null) {
        flattened.push({ ")": value.operation as "+" });
      } else {
        flattened.push({ ")": true });
      }
    }

    return flattened;
  };

  let result = [...flatten(value)];
  if (transform) {
    result = addTransform(result, transform);
  }
  return result;
};
