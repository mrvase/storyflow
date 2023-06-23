import type { TokenStream } from "./types";
import { tokens } from "@storyflow/cms/tokens";
import { matchNonEscapedCharacter } from "./escaped-characters";

function forEach(
  stream: TokenStream,
  callback: (value: any, index: number) => boolean | void,
  splitText: boolean = true
) {
  let index = 0;
  for (let cIndex = 0; cIndex < stream.length; cIndex++) {
    let el = stream[cIndex];
    if (!tokens.hasVariableLength(el)) {
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
  /*
  stream.forEach((el) => {
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
function getLength(stream: TokenStream): number {
  return (stream as any).reduce(
    (sum: number, el: TokenStream[number]): number => {
      if (!tokens.hasVariableLength(el)) {
        return sum + 1;
      } else {
        const length: number = `${el}`.length;
        return sum + length;
      }
    },
    0
  );
}

function slice(stream: TokenStream, _start: number, _end?: number) {
  let start = _start < 0 ? getLength(stream) - _start : _start;
  let end =
    _end === undefined
      ? getLength(stream)
      : _end < 0
      ? getLength(stream) + _end
      : _end;
  let array: TokenStream = [];
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
  forEach(stream, (el, index) => {
    if (index < start) {
      return;
    }
    if (index >= end) {
      return true;
    }
    let latest = array[array.length - 1];
    if (typeof el === "string" && typeof latest === "string") {
      array[array.length - 1] = `${latest}${el}`;
    } else {
      push(el);
    }
  });
  checkLatest();
  return array;
}

function concat(stream: TokenStream, ...args: TokenStream[]) {
  const concatTwo = (arg1: TokenStream, arg2: TokenStream) => {
    if (
      typeof arg1[arg1.length - 1] === "number" &&
      typeof arg2[0] === "number"
    ) {
      const transform = (el: string) =>
        arg1[arg1.length - 1] !== 0 ? Number(el) : el;
      // the zero will disappear if we merge 0 and number to one
      const merged = `${arg1[arg1.length - 1]}${arg2[0]}`;
      return [...arg1.slice(0, -1), transform(merged), ...arg2.slice(1)];
    }
    if (
      ["string", "number"].includes(typeof arg1[arg1.length - 1]) &&
      ["string", "number"].includes(typeof arg2[0])
    ) {
      let merged: string | number = `${arg1[arg1.length - 1]}${arg2[0]}`;
      if (merged.match(/\d+\.\d+/)) merged = Number(merged);
      return [...arg1.slice(0, -1), merged, ...arg2.slice(1)];
    }
    return [...arg1, ...arg2];
  };
  const value: TokenStream = args.reduce((a: TokenStream, c) => {
    return concatTwo(a, c);
  }, stream);
  return value;
}

function getType(value: TokenStream[number] | undefined) {
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

function equals(compute1: TokenStream, compute2: TokenStream) {
  if (getLength(compute1) !== getLength(compute2)) {
    return false;
  }
  let result = true;
  forEach(compute1, (value1, index) => {
    let value2 = at(compute2, index);
    if (getType(value1) !== getType(value2)) {
      result = false;
      // from now on they are the same type
    } else if (tokens.isNestedField(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (tokens.isNestedDocument(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (tokens.isNestedElement(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (tokens.isNestedDocument(value2)) {
      if (value1.id !== value2.id) {
        result = false;
      }
    } else if (tokens.isFileToken(value2)) {
      if (value1.src !== value2.src) {
        result = false;
      }
    } else if (tokens.isCustomToken(value2)) {
      if (value1.name !== value2.name) {
        result = false;
      }
    } else if (tokens.isColorToken(value2)) {
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

function at(stream: TokenStream, index: number) {
  // BEMÆRK: Returnerer altid string og aldrig number
  let result: TokenStream[number] | undefined;
  forEach(stream, (el, i) => {
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
  const value = slice(stream, index, index + 1);
  if (value.length === 0) {
    return;
  }
  return value[0];
  */
}

function match(
  value: TokenStream,
  ...patterns: (string | ((value: TokenStream[number]) => boolean))[]
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

function removeCharacters(value: TokenStream, pattern: string) {
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
  value: TokenStream,
  ...patterns: (string | ((value: TokenStream[number]) => boolean))[]
) {
  const matches = match(value, ...patterns);
  let array: TokenStream[] = [];
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
};
