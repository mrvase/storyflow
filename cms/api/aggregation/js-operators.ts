import { Operators, SwitchObject } from "./types";

export const operators: Operators<any> = {
  useDocument: (callback) => callback(undefined),
  map: (arr, callback) => {
    return arr.map((el) => callback(el));
  },
  reduce: (arr, callback, initialValue) => {
    return arr.reduce((acc, el) => callback(acc, el), initialValue);
  },
  add(numbers) {
    return numbers.reduce((a, c) => a + c);
  },
  subtract(numbers) {
    return numbers.reduce((a, c) => a - c);
  },
  multiply(numbers) {
    return numbers.reduce((a, c) => a * c);
  },
  divide(numbers) {
    return numbers.reduce((a, c) => a / c);
  },
  define() {
    const lets: Array<{ [key: string]: any }> = [];

    const createObj = <U extends { [key: string]: any }>(initial: U) => ({
      let: <P extends { [key: string]: any }>(
        callback: P | ((refs: U) => P)
      ) => {
        const added =
          typeof callback === "function" ? callback(initial) : callback;
        lets.push(added);
        return createObj({ ...initial, ...added } as U & P);
      },
      return: (callback: (refs: U) => any) => {
        return callback(initial);
      },
    });

    return createObj({});
  },
  filter(arr, callback) {
    return arr.filter((el) => callback(el));
  },
  find(arr, callback) {
    return arr.find((el) => callback(el)) ?? null;
  },
  eq(val1, val2) {
    return val1 === val2;
  },
  and(...vals: any[]) {
    return vals.every((x) => Boolean(x));
  },
  or(...vals: any[]) {
    return vals.some((x) => Boolean(x));
  },
  cond(condition, ifTrue, ifFalse) {
    if (condition) {
      return ifTrue();
    } else {
      return ifFalse();
    }
  },
  concatArrays(...arrays) {
    return arrays.reduce((a, c) => a.concat(c));
  },
  mergeObjects(a, b, c) {
    return Object.assign({}, a, b, c);
  },
  first(arr: any[]) {
    return arr[0];
  },
  last(arr: any[]) {
    return arr[arr.length - 1];
  },
  at(arr: any[], index) {
    return arr[index];
  },
  anyElementTrue(arr) {
    return arr.some(Boolean);
  },
  not(val: boolean) {
    return !Boolean(val);
  },
  ne(val1, val2) {
    return val1 !== val2;
  },
  in(val1, val2) {
    return val2.includes(val1);
  },
  concat(...strings: string[]) {
    return strings.reduce((a, c) => `${a}${c}`);
  },
  type(val: any) {
    if (Array.isArray(val)) {
      return "array";
    }
    if (val === null) {
      return "null";
    }
    if (val instanceof Date) {
      return "date";
    }
    if (typeof val === "boolean") {
      return "bool";
    }
    if (typeof val === "string") {
      return "string";
    }
    if (typeof val === "number") {
      return "double";
    }
    if (typeof val === "undefined") {
      return "undefined";
    }
    return "object";
  },
  isNumber(val: any) {
    return typeof val === "number";
  },
  isArray(val: any) {
    return Array.isArray(val);
  },
  gt(val1: number, val2: number) {
    return val1 > val2;
  },
  gte(val1: number, val2: number) {
    return val1 >= val2;
  },
  lt(val1: number, val2: number) {
    return val1 < val2;
  },
  lte(val1: number, val2: number) {
    return val1 <= val2;
  },
  number(input: any, fallback = 0) {
    return typeof input === "number" ? input : fallback;
  },
  string(input: any, fallback = "") {
    return typeof input === "string" ? input : fallback;
  },
  array(input: any) {
    return Array.isArray(input) ? input : [];
  },
  setUnion(...arrays) {
    return [...new Set(arrays.reduce((a, c) => a.concat(c)))];
  },
  size(arr) {
    return arr.length;
  },
  ifNull(value, alternative) {
    return (value ?? alternative) as typeof value extends null | undefined
      ? typeof alternative
      : typeof value;
  },
  getField(input, field) {
    return input[field];
  },
  toString(input) {
    return String(input);
  },
  toBool(input) {
    return Boolean(input);
  },
  switch() {
    const createObj = <U>(branches: any[]): SwitchObject<U> => ({
      case: <T>(cond: boolean, then: () => T) => {
        branches.push({
          case: cond,
          then,
        });
        return createObj<U | T>(branches);
      },
      default: <T>(value: () => T) => {
        const success = branches.find((el) => Boolean(el.case));
        if (success !== undefined) return success.then();
        return value();
      },
    });

    return createObj([]);
  },
  slice(arr, start, end) {
    return arr.slice(start, end);
  },
  range(start, end, step = 1) {
    return Array.from({ length: end - start }, (_, x) => x * step + start);
  },
  arrayToObject(array) {
    if (array.length === 0) return {};
    const hasObjectElements = (
      arr: typeof array
    ): arr is { k: any; v: any }[] => {
      return "k" in array[0] && "v" in array[0];
    };
    if (hasObjectElements(array)) {
      return Object.fromEntries(array.map(({ k, v }) => [k, v]));
    }
    return Object.fromEntries(array);
  },
  objectToArray(object) {
    return Object.entries(object).map(([k, v]) => ({
      k: k as keyof typeof object,
      v: v as typeof object[keyof typeof object],
    }));
  },
  substrBytes(string, start, length) {
    return string.substring(start, length + start);
  },
  pop(array) {
    return array.slice(0, -1);
  },
  reduceWithIndex(arr, callback, initialValue) {
    return arr.reduce(
      (acc, el) => ({ v: callback(acc.v, el, acc.i), i: acc.i + 1 }),
      { v: initialValue, i: 0 }
    ).v;
  },
  toLower(input) {
    return input.toLowerCase();
  },
  replaceOne(input, find, replacement) {
    return input.replace(new RegExp(find), replacement);
  },
  regexFindAll(input, regex, options) {
    return Array.from(
      input.matchAll(new RegExp(regex, `g${options.replace("g", "")}`)),
      (x) => ({
        match: x[0],
        idx: x.index as number,
        captures: x as string[],
      })
    );
  },
  max(numbers) {
    return Math.max(...numbers);
  },
};
