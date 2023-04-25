import { FieldId } from "@storyflow/shared/types";
import { DBId } from "@storyflow/db-core/types";

export type DefineObject<U extends { [key: string]: any }> = {
  let: <P extends { [key: string]: any }>(
    callback: P | ((vars: U) => P)
  ) => DefineObject<U & P>;
  return: <T>(callback: (vars: U) => T) => T;
};

export type SwitchObject<U> = {
  case: <T>(condition: boolean, then: () => T) => SwitchObject<U | T>;
  default: <T>(value: () => T) => U | T;
};

export type Operators<DocumentType extends Record<string, any>> = {
  useDocument: <T>(callback: ($doc: DocumentType) => T) => T;
  map: <Input, Output>(
    arr: Array<Input>,
    callback: (value: Input) => Output
  ) => Array<Output>;
  reduce: <Accumulator, Element>(
    arr: Element[],
    callback: (acc: Accumulator, element: Element) => Accumulator,
    initialValue: Accumulator
  ) => Accumulator;
  reduceWithIndex: <Accumulator, Element>(
    arr: Element[],
    callback: (
      acc: Accumulator,
      element: Element,
      index: number
    ) => Accumulator,
    initialValue: Accumulator
  ) => Accumulator;
  add: (numbers: number[]) => number;
  subtract: (numbers: number[]) => number;
  multiply: (numbers: number[]) => number;
  divide: (numbers: number[]) => number;
  define: () => DefineObject<{}>;
  filter: <Input>(
    arr: Array<Input>,
    callback: (value: Input) => boolean
  ) => Array<Input>;
  find: <Input>(
    arr: Array<Input>,
    callback: (value: Input) => boolean
  ) => Input | null;
  eq: <T, U extends T>(arg1: T, arg2: U) => boolean;
  cond: <Success, Failure>(
    condition: boolean,
    ifTrue: () => Success,
    ifFalse: () => Failure
  ) => Success | Failure;
  concatArrays: <T>(...arrays: T[][]) => T[];
  reverseArray: <T>(array: T[]) => T[];
  mergeObjects: <
    A extends object,
    B extends object = {},
    C extends object = {}
  >(
    object1: A,
    object2?: B,
    object3?: C
  ) => A & B & C;
  and: (...args: any[]) => boolean;
  or: (...args: any[]) => boolean;
  not: (arg: boolean) => boolean;
  in: <T extends any[], U extends T[number]>(arg1: U, arg2: T) => boolean;
  ne: <T, U extends Exclude<any, T>>(arg1: T, arg2: U) => boolean;
  first: <T extends any[]>(
    arr: T
  ) => T extends [infer First, ...any]
    ? First
    : T extends any[]
    ? T[number]
    : never;
  last: <T extends any[]>(
    arr: T
  ) => T extends [...any, infer Last] ? Last : T[number];
  at: <Input>(arr: Array<Input>, index: number) => Input;
  anyElementTrue: (arr: any[]) => boolean;
  concat: (strings: string[]) => string;
  type: (
    value: any
  ) =>
    | "array"
    | "object"
    | "string"
    | "bool"
    | "null"
    | "undefined"
    | "double"
    | "date"
    | "objectId";
  isNumber: (value: any) => boolean;
  isArray: (value: any) => boolean;
  toString: (input: any) => string;
  toObjectId: (input: any) => DBId<FieldId>;
  toBool: (input: any) => boolean;
  lt: (arg1: number, arg2: number) => boolean;
  lte: (arg1: number, arg2: number) => boolean;
  gt: (arg1: number, arg2: number) => boolean;
  gte: (arg1: number, arg2: number) => boolean;
  max: (numbers: number[]) => number;
  number: (val: any, fallback?: number) => number;
  string: (val: any, fallback?: string) => string;
  array: (val: any) => any[];
  setUnion: <T>(...arrays: T[][]) => T[];
  setIntersection: <T>(...arrays: T[][]) => T[];
  size: (val: any[]) => number;
  slice: <T>(val: T[], start: number, end?: number) => T[];
  ifNull: <V, A>(
    value: V,
    alternative: A
  ) => V extends null | undefined ? A : V;
  getField: <T extends { [key: string]: any }, U extends keyof T>(
    input: T,
    field: U
  ) => T[U];
  switch: () => SwitchObject<never>;
  range: (start: number, end: number, step?: number) => number[];
  arrayToObject: <K extends string, T>(
    array: [K, T][] | { k: K; v: T }[]
  ) => {
    [key: string]: T;
  };
  objectToArray: <K extends string, T>(object: { [key in K]: T }) => {
    k: K;
    v: T;
  }[];
  substrBytes: (string: string, start: number, length: number) => string;
  pop: <T>(array: T[]) => T[];
  toLower: (input: string) => string;
  regexFindAll: (
    input: string,
    regex: string,
    options: string
  ) => { match: string; idx: number; captures: string[] }[];
  replaceOne: (input: string, find: string, replacement: string) => string;
  sortArray: <T extends Record<string, any>>(
    input: T[],
    sortBy: Partial<Record<keyof T, 1 | -1>>
  ) => T[];
  trim: (input: string) => string;
  literal: <T>(val: T) => T;
  /*
  reverseArray: <T extends any[]>(arr: T) => T;
  */
};

export type Narrow<T, N> = T extends N ? T : never;
