import { symb } from "@storyflow/backend/symb";
import { EditorComputation } from "@storyflow/backend/types";
import { matchNonEscapedCharacter } from "./matchNonEscapedCharacter";

function forEach(
  compute: EditorComputation,
  callback: (value: any, index: number) => boolean | void,
  splitText: boolean = true
) {
  let index = 0;
  for (let cIndex = 0; cIndex < compute.length; cIndex++) {
    let el = compute[cIndex];
    if (!symb.isPrimitiveValue(el)) {
      if (callback(el, index++)) return;
    } else {
      if (typeof el === "boolean") {
        if (callback(el, index++)) return;
      } else {
        if (splitText) {
          if (el === "") {
            if (callback(el, index++)) return;
          } else {
            let string = `${el}`;
            let length = string.length;
            for (let tIndex = 0; tIndex < length; tIndex++) {
              if (callback(string[tIndex], index++)) return;
            }
          }
        } else {
          if (callback(`${el}`, index)) return;
          index += `${el}`.length;
        }
      }
    }
  }
  /*
  compute.forEach((el) => {
    if (!isValue(el)) {
      callback(el, index++);
    } else {
      if (typeof el === "boolean") {
        callback(el, index++);
      } else {
        if (splitText) {
          if (el === "") {
            callback(el, index++);
          } else {
            `${el}`.split("").forEach((el) => {
              callback(el, index++);
            });
          }
        } else {
          callback(`${el}`, index);
          index += `${el}`.length;
        }
      }
    }
  });
  */
}
function getLength(compute: EditorComputation): number {
  return (compute as any).reduce(
    (sum: number, el: EditorComputation[number]): number => {
      if (!symb.isPrimitiveValue(el)) {
        return sum + 1;
      } else if (typeof el === "boolean") {
        return sum + 1;
      } else {
        const length: number = `${el}`.length;
        return sum + length;
      }
    },
    0
  );
}

function slice(compute: EditorComputation, _start: number, _end?: number) {
  let start = _start < 0 ? getLength(compute) - _start : _start;
  let end =
    _end === undefined
      ? getLength(compute)
      : _end < 0
      ? getLength(compute) + _end
      : _end;
  let array: EditorComputation = [];
  if (start === end) {
    return array;
  }
  const checkLatest = () => {
    let latest = array[array.length - 1];
    if (`${Number(latest)}` === latest) {
      array[array.length - 1] = Number(latest);
    }
  };
  let push = (el: any) => {
    checkLatest();
    array.push(el);
  };
  forEach(compute, (el, index) => {
    if (index < start) {
      return;
    }
    if (index >= end) {
      return true;
    }
    let latest = array[array.length - 1];
    if (!symb.isPrimitiveValue(el)) {
      push(el);
    } else {
      if (typeof el === "string" && typeof latest === "string") {
        array[array.length - 1] = `${latest}${el}`;
      } else {
        push(el);
      }
    }
  });
  checkLatest();
  return array;
}

function concat(compute: EditorComputation, ...args: EditorComputation[]) {
  const concatTwo = (arg1: EditorComputation, arg2: EditorComputation) => {
    if (
      typeof arg1[arg1.length - 1] === "string" &&
      typeof arg2[0] === "string"
    ) {
      return [
        ...arg1.slice(0, -1),
        `${arg1[arg1.length - 1]}${arg2[0]}`,
        ...arg2.slice(1),
      ];
    }
    if (
      typeof arg1[arg1.length - 1] === "number" &&
      typeof arg2[0] === "number"
    ) {
      const transform = (el: string) =>
        arg1[arg1.length - 1] !== 0 ? Number(el) : el;
      // the zero will disappear if we merge 0 and number to one

      return [
        ...arg1.slice(0, -1),
        transform(`${arg1[arg1.length - 1]}${arg2[0]}`),
        ...arg2.slice(1),
      ];
    }
    return [...arg1, ...arg2];
  };
  const value: EditorComputation = args.reduce(
    (a: EditorComputation, c) => concatTwo(a, c),
    compute
  );
  return value;
}

const compareArrays = (arr1: any[], arr2: any[]) => {
  return (
    arr1.length === arr2.length && arr1.every((el, index) => el === arr2[index])
  );
};

function getType(value: EditorComputation[number] | undefined) {
  if (value === null) return "null";
  if (typeof value === "object") {
    // values
    if ("dref" in value) return "document-import";
    if ("values" in value) return "nested-document";
    if ("type" in value) return "layout-element";
    if ("src" in value) return "file-token";
    if ("color" in value) return "color-token";

    // placeholders
    if ("fref" in value) return "field-import";
    if ("filters" in value) return "fetcher";
    if ("x" in value) return "parameter";

    // symbols
    return "symbol";
  }
  return typeof value;
}

function equals(compute1: EditorComputation, compute2: EditorComputation) {
  if (getLength(compute1) !== getLength(compute2)) {
    return false;
  }
  let result = true;
  forEach(compute1, (value1, index) => {
    let value2 = at(compute2, index);
    if (getType(value1) !== getType(value2)) {
      result = false;
      // from now on they are the same type
    } else if (symb.isFieldImport(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (symb.isDocumentImport(value2)) {
      if (value1.dref !== value2.dref) {
        result = false;
      }
    } else if (symb.isLayoutElement(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (symb.isNestedDocument(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (symb.isFileToken(value2)) {
      if (value1.src !== value2.src) {
        result = false;
      }
    } else if (symb.isColorToken(value2)) {
      if (value1.color !== value2.color) {
        result = false;
      }
    } else if (typeof value2 === "object") {
      const arr1 = Object.entries(value1)[0]; // [key, value]
      const arr2 = Object.entries(value2)[0]; // [key, value]
      // if the keys or the values are different
      if (arr1.some((el, index) => el !== arr2[index])) {
        result = false;
      }
    } else if (String(value1) !== String(value2)) {
      result = false;
    }
  });
  return result;
}

function at(compute: EditorComputation, index: number) {
  // BEMÆRK: Returnerer altid string og aldrig number
  let result: EditorComputation[number] | undefined;
  forEach(compute, (el, i) => {
    if (i < index) {
      return;
    }
    if (i === index) {
      result = el;
    }
    return true;
  });
  return result;
  /*
  const value = slice(compute, index, index + 1);
  if (value.length === 0) {
    return;
  }
  return value[0];
  */
}

function match(
  value: EditorComputation,
  ...patterns: (string | ((value: EditorComputation[number]) => boolean))[]
) {
  let matches: { index: number; value: string | { n: true } }[] = [];
  forEach(
    value,
    (el, index) => {
      for (let p = 0; p < patterns.length; p++) {
        let pattern = patterns[p];
        if (typeof pattern === "string" && typeof el === "string") {
          const newMatches = matchNonEscapedCharacter(el, pattern);
          if (newMatches.length) {
            matches.push(
              ...newMatches.map((el) => ({ ...el, index: el.index + index }))
            );
            break;
          }
        } else if (typeof pattern === "function" && pattern(el)) {
          matches.push({ index, value: { n: true } });
          break;
        }
      }
    },
    false /* DO NOT SPLIT TEXT */
  );
  return matches;
}

function removeCharacters(value: EditorComputation, pattern: string) {
  const matches = match(value, pattern);
  let newValue = value;
  matches.reverse().forEach((el) => {
    newValue = concat(
      slice(newValue, 0, el.index),
      slice(newValue, el.index + getLength([el.value]))
    );
  });
  return newValue;
}

function split(
  value: EditorComputation,
  ...patterns: (string | ((value: EditorComputation[number]) => boolean))[]
) {
  const matches = match(value, ...patterns);
  let array: EditorComputation[] = [];
  let prev = 0;
  matches.forEach((el) => {
    const matchLength = getLength([el.value]);
    array.push(slice(value, prev, el.index));
    array.push(slice(value, el.index, el.index + matchLength));
    prev = el.index + matchLength;
  });
  array.push(slice(value, prev, getLength(value)));
  return array;
}

function join(value: EditorComputation) {}

export const tools = {
  at,
  equals,
  slice,
  forEach,
  concat,
  getLength,
  match,
  split,
  removeCharacters,
  ...symb,
};
