import {
  Token,
  Computation,
  EditorComputation,
  FunctionName,
  Operator,
  Placeholder,
  TemplateFieldId,
  Value,
} from "@storyflow/backend/types";
import { tools } from "./editor-tools";

type DBElement = Computation[number];
type EditorElement = EditorComputation[number];

type GroupedEditorElement =
  | EditorElement
  | { group: GroupedEditorElement[]; type: string };

const isValueOrPlaceholder = (
  el: DBElement | EditorElement
): el is Value | Placeholder => {
  return !Array.isArray(el) || typeof el[0] === "number";
};

const isSeparator = (el: any, specify?: "," | "n"): el is [","] =>
  Array.isArray(el) &&
  ((el[0] === "," && specify !== "n") || (el[0] === "n" && specify !== ","));

const addTransform = (
  db: Computation,
  transform: FunctionName
): Computation => {
  return [["("], ...db, [")", transform]];
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
    value?: [Operator]
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
    return (
      (prev !== null && typeof prev === "object" && "group" in prev) ||
      isValueOrPlaceholder(prev)
    );
  };

  const flatten = (
    value: GroupedEditorElement[],
    parentOperator?: string
  ): EditorElement[] => {
    const flattened: EditorElement[] = [];
    value.forEach((el) => {
      if (el !== null && typeof el === "object" && "group" in el) {
        const nestedAddition =
          ["*", "/"].includes(parentOperator as string) &&
          ["+", "-"].includes(el.type);
        if (nestedAddition || el.type === "paren") {
          flattened.push(["("]);
        }
        flattened.push(...flatten(el.group, el.type));
        if (nestedAddition || el.type === "paren") {
          flattened.push([")"]);
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
        saved.push([","]);
      }

      let group = replaceSeparators(value, [el[1]]);

      // edge cases
      if (group[0] === null) {
        group.shift();
      } else if (group.length === 1) {
        group.push([el[1]]);
      }

      saved.push({
        group,
        type: el[1],
      });
      value = saved;
      stack.pop();
    } else if (tools.isDBSymbol(el, "p")) {
      const saved = stack[stack.length - 1];
      if (prevIsValueOrPlaceholder(saved)) {
        saved.push([","]);
      }
      if (value.length === 1 && tools.isImport(value[0], "field")) {
        const fieldImport = { ...value[0] };
        fieldImport.pick = el[1] as TemplateFieldId;
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
        saved.push([","]);
      }
      saved.push({
        group: value,
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
        value.push([","]);
      }
      if (tools.isImport(el, "field")) {
        value.push(el);
      } else if (isValueOrPlaceholder(el)) {
        value.push(el);
      } else if (tools.isDBSymbol(el, "n")) {
        value.push(el);
      } else if (tools.isToken(el)) {
        value.push(el);
      }
    }
  });

  return flatten(value);
};

type DbFunction = {
  parameters: (DbFunction | Value | Placeholder | [","] | ["n"] | Token)[];
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
      if (current.operation !== el[0]) {
        if (
          ["+", "-"].includes(el[0]) &&
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
            parameters: [current, [","]],
            operation: el[0],
            parent: current.parent,
          };
          current.parent!.parameters[swapIndex] = func;
          current = func;
        } else {
          const last = current.parameters[current.parameters.length - 1];
          current.parameters.pop();
          const func: DbFunction = {
            parameters: [last ?? null, [","]],
            operation: el[0],
            parent: current,
          };
          current.parameters.push(func);
          current = func;
        }
      } else {
        current.parameters.push([","]);
      }
    } else if (tools.isImport(el, "field")) {
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
    } else if (tools.isToken(el)) {
      current.parameters.push(el);
    } else if (isValueOrPlaceholder(el)) {
      current.parameters.push(el);
    }
  });

  /*
  const isMergeable = (el: DBElement | DbFunction | [","]) => {
    return (
      tools.isImport(el, "field") ||
      (Array.isArray(el) && typeof el[0] === "number") ||
      ["string", "number"].includes(typeof el) ||
      (typeof el === "object" && "parameters" in el)
    );
  };
  */

  const getMergeableSpans = (
    params: (DbFunction | Value | Placeholder | [","] | ["n"] | Token)[]
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
      value.parameters[0] !== null &&
      typeof value.parameters[0] === "object" &&
      "operation" in value.parameters[0] &&
      ["+", "-"].includes(value.parameters[0].operation as string);

    const isAutoParen =
      childIsAddition &&
      value.operation === null &&
      ["*", "/"].includes(value.parent?.operation as string);

    if (!isRoot && !isAutoParen) {
      if (value.operation === "merge") {
        flattened.push(["{"]);
      } else {
        flattened.push(["("]);
      }
    }

    value.parameters.forEach((el) => {
      if (el !== null && typeof el === "object" && "parameters" in el) {
        flattened.push(...flatten(el));
      } else if (isSeparator(el, ",")) {
        // do nothing
      } else {
        flattened.push(el);
      }
    });

    if (!isRoot && !isAutoParen) {
      if (value.operation === "merge") {
        flattened.push(["}"]);
      } else if (value.operation === "pick") {
        flattened.push(["p", value.pick!]);
      } else if (value.operation !== null) {
        flattened.push([")", value.operation as "+"]);
      } else {
        flattened.push([")"]);
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
