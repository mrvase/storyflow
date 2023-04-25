import type { FieldId } from "@storyflow/shared/types";
import type { DBId } from "@storyflow/db-core/types";
import type { Operators, SwitchObject } from "./types";
import { isObjectId } from "@storyflow/db-core/mongo";

const createProxy = (value: string): any => {
  return new Proxy({ $$ref: `$$${value}` } as Record<string, any>, {
    get(obj, _prop: string) {
      if (typeof _prop !== "string") {
        return obj[_prop];
      }
      const prop = _prop;
      if (prop in obj) {
        return obj[prop];
      }
      obj[prop] = createProxy(
        `${value}${value.replace("$", "") ? "." : ""}${prop}`
      );
      return obj[prop];
    },
  });
};

export const createOperators = () => {
  let count = 0;
  let getRef = () => `r${count++}`;

  const operators: Operators<any> = {
    useDocument: (callback) =>
      stringifyProxies(callback(createProxy("CURRENT"))),
    map: (arr, callback) => {
      const ref = getRef();

      const elementProxy = createProxy(ref);

      return {
        $map: {
          input: arr,
          as: ref,
          in: stringifyProxies(callback(elementProxy as (typeof arr)[number])),
        },
      } as unknown as Array<ReturnType<typeof callback>>;
    },
    reduce: (arr, callback, initialValue) => {
      const accumulator = getRef();
      const current = getRef();
      const accumulatorProxy = createProxy(accumulator);
      const currentProxy = createProxy(current);
      return {
        $reduce: {
          input: arr,
          initialValue,
          in: {
            $let: {
              vars: {
                [accumulator]: "$$value",
                [current]: "$$this",
              },
              in: stringifyProxies(
                callback(
                  accumulatorProxy as typeof initialValue,
                  currentProxy as (typeof arr)[number]
                )
              ),
            },
          },
        },
      } as typeof initialValue;
    },
    reduceWithIndex: (arr, callback, initialValue) => {
      const accumulator = getRef();
      const current = getRef();
      const accumulatorProxy = createProxy(accumulator);
      const currentProxy = createProxy(current);
      return {
        $getField: {
          input: {
            $reduce: {
              input: arr,
              initialValue: {
                v: initialValue,
                i: 0,
              },
              in: {
                $let: {
                  vars: {
                    [accumulator]: "$$value",
                    [current]: "$$this",
                  },
                  in: stringifyProxies({
                    v: callback(
                      accumulatorProxy.v as typeof initialValue,
                      currentProxy as (typeof arr)[number],
                      accumulatorProxy.i as number
                    ),
                    i: { $add: [0, accumulatorProxy.i, 1] },
                  }),
                },
              },
            },
          },
          field: "v",
        },
      } as typeof initialValue;
    },
    add(numbers) {
      return { $add: numbers } as unknown as number;
    },
    subtract(numbers) {
      return { $subtract: numbers } as unknown as number;
    },
    multiply(numbers) {
      return { $multiply: numbers } as unknown as number;
    },
    divide(numbers) {
      return { $divide: numbers } as unknown as number;
    },
    define() {
      const toRefs = <U extends { [key: string]: any }>(vars: U): U => {
        return Object.fromEntries(
          Object.keys(vars).map((el) => [el, createProxy(el)])
        ) as U;
      };
      const lets: Array<{ [key: string]: any }> = [];

      const createObj = <U extends { [key: string]: any }>(initial: U) => ({
        let: <P extends { [key: string]: any }>(
          callback: P | ((refs: U) => P)
        ) => {
          const added =
            typeof callback === "function"
              ? stringifyProxies(callback(toRefs(initial)))
              : callback;
          lets.push(added);
          return createObj({ ...initial, ...added } as U & P);
        },
        return: (callback: (refs: U) => any) => {
          return [
            stringifyProxies(callback(toRefs(initial))),
            ...lets.reverse(),
          ].reduce((acc, cur) => ({
            $let: {
              vars: cur,
              in: acc,
            },
          }));
        },
      });

      return createObj({});
    },
    filter(arr, callback) {
      const ref = getRef();
      return {
        $filter: {
          input: arr,
          as: ref,
          cond: callback(createProxy(ref)),
        },
      } as unknown as typeof arr;
    },
    find(arr, callback) {
      const ref = getRef();
      return {
        $first: {
          $filter: {
            input: arr,
            as: ref,
            cond: callback(createProxy(ref)),
          },
        },
      } as unknown as (typeof arr)[number];
    },
    eq(val1, val2) {
      return {
        $eq: [val1, val2],
      } as unknown as boolean;
    },
    and(...vals: any[]) {
      return {
        $and: vals,
      } as unknown as boolean;
    },
    or(...vals: any[]) {
      return {
        $or: vals,
      } as unknown as boolean;
    },
    cond(condition, ifTrue, ifFalse) {
      return {
        $cond: {
          if: condition,
          then: ifTrue(),
          else: ifFalse(),
        },
      } as unknown as ReturnType<typeof ifTrue> | ReturnType<typeof ifFalse>;
    },
    concatArrays(...arrays) {
      return {
        $concatArrays: arrays,
      } as unknown as (typeof arrays)[number];
    },
    reverseArray(array) {
      return {
        $reverseArray: array,
      } as unknown as typeof array;
    },
    mergeObjects(a, b, c) {
      return {
        $mergeObjects: [a, ...(b ? [b] : []), ...(c ? [c] : [])],
      } as unknown as typeof a & typeof b & typeof c;
    },
    first(arr) {
      return { $first: arr } as unknown as (typeof arr)[number];
    },
    last(arr) {
      return { $last: arr } as unknown as (typeof arr)[number];
    },
    at(arr, index) {
      return { $arrayElemAt: [arr, index] } as unknown as (typeof arr)[number];
    },
    anyElementTrue(arr) {
      return { $anyElementTrue: arr } as unknown as boolean;
    },
    not(val) {
      return { $not: val } as unknown as boolean;
    },
    ne(val1, val2) {
      return { $ne: [val1, val2] } as unknown as boolean;
    },
    in(val1, val2) {
      return { $in: [val1, val2] } as unknown as boolean;
    },
    concat(strings: string[]) {
      return { $concat: strings } as unknown as string;
    },
    type(val: any) {
      return { $type: val } as unknown as "object";
    },
    isNumber(val: any) {
      return { $isNumber: val } as unknown as boolean;
    },
    isArray(val: any) {
      return { $isArray: val } as unknown as boolean;
    },
    gt(val1: number, val2: number) {
      return { $gt: [val1, val2] } as unknown as boolean;
    },
    gte(val1: number, val2: number) {
      return { $gte: [val1, val2] } as unknown as boolean;
    },
    lt(val1: number, val2: number) {
      return { $lt: [val1, val2] } as unknown as boolean;
    },
    lte(val1: number, val2: number) {
      return { $lte: [val1, val2] } as unknown as boolean;
    },
    number(input: any, fallback = 0) {
      return {
        $cond: {
          if: { $isNumber: input },
          then: input,
          else: fallback,
        },
      } as unknown as number;
    },
    string(input: any, fallback = "") {
      return {
        $cond: {
          if: { $eq: [{ $type: input }, "string"] },
          then: input,
          else: fallback,
        },
      } as unknown as string;
    },
    array(input: any) {
      return {
        $cond: {
          if: { $eq: [{ $type: input }, "array"] },
          then: input,
          else: { $literal: [] },
        },
      } as unknown as any[];
    },
    setUnion(...arrays) {
      return {
        $setUnion: arrays,
      } as unknown as (typeof arrays)[number];
    },
    setIntersection(...arrays) {
      return {
        $setIntersection: arrays,
      } as unknown as (typeof arrays)[number];
    },
    size(arr) {
      return {
        $size: arr,
      } as unknown as number;
    },
    ifNull(value, alternative) {
      return {
        $ifNull: [value, alternative],
      } as typeof value extends null | undefined
        ? typeof alternative
        : typeof value;
    },
    getField(input, field) {
      return {
        $getField: {
          input,
          field,
        },
      } as unknown as (typeof input)[typeof field];
    },
    switch() {
      const createObj = <U>(branches: any[]): SwitchObject<U> => ({
        case: <T>(cond: boolean, then: () => T) => {
          branches.push({
            case: cond,
            then: then(),
          });
          return createObj<U | T>(branches);
        },
        default: <T>(value: () => T) => {
          return {
            $switch: {
              branches,
              default: value(),
            },
          } as unknown as U | T;
        },
      });

      return createObj([]);
    },
    toString(input) {
      return { $toString: input } as unknown as string;
    },
    toObjectId(input) {
      return { $toObjectId: input } as unknown as DBId<FieldId>;
    },
    toBool(input) {
      return { $toBool: input } as unknown as boolean;
    },
    slice(arr, start, end) {
      // WE FOLLOW THE JAVASCRIPT IMPLEMENTATION.
      // js parameters are start and end, while mongodb parameters are start and length.
      if (end === undefined) {
        if (start === 0) {
          return arr;
        }
        if (start < 0) {
          // slice([1, 2, 3], -2) --> [2, 3]
          return {
            $slice: [arr, start],
          } as unknown as typeof arr;
        }
        const length = { $subtract: [{ $size: arr }, start] };
        return {
          $slice: [arr, start, length],
        } as unknown as typeof arr;
      } else if (start < end) {
        if (start < 0 && end >= 0) {
          throw new Error(
            `There is currently no implementation for $.slice where start < 0 and end >= 0. You provided start=${start}, end=${end}`
          );
        }
        const length = end - start;
        return {
          $slice: [arr, start, length],
        } as unknown as typeof arr;
      } else if (end < start && end >= 0) {
        return [];
      } else if (start >= 0 && end < 0) {
        const length = { $subtract: [{ $size: arr }, start - end] };
        return {
          $slice: [arr, start, length],
        } as unknown as typeof arr;
      }
      throw new Error(
        `$.slice has illegal start and end parameters, start=${start}, end=${end}`
      );
    },
    range(start, end, step) {
      return {
        $range: [start, end].concat(step ? [step] : []),
      } as unknown as number[];
    },
    objectToArray(object) {
      return {
        $objectToArray: object,
      } as unknown as { k: any; v: any }[];
    },
    arrayToObject(array) {
      return {
        $arrayToObject: [array],
      } as unknown as { [key: string]: any };
    },
    substrBytes(string, start, length) {
      return {
        $substrBytes: [string, start, length],
      } as unknown as string;
    },
    pop(array) {
      return {
        $cond: {
          if: { $lte: [{ $size: array }, 1] },
          then: { $literal: [] },
          else: {
            $slice: [array, 0, { $subtract: [{ $size: array }, 1] }],
          },
        },
      } as unknown as typeof array;
    },
    toLower(input) {
      return {
        $toLower: input,
      } as unknown as string;
    },
    replaceOne(input, find, replacement) {
      return {
        $replaceOne: { input, find, replacement },
      } as unknown as string;
    },
    regexFindAll(input, regex, options) {
      return {
        $regexFindAll: { input, regex, options },
      } as unknown as { match: string; idx: number; captures: string[] }[];
    },
    max(numbers) {
      return {
        $max: numbers,
      } as unknown as number;
    },
    sortArray(input, sortBy) {
      /* TODO: mongo 5.2
    return {
      $sortArray: { input, sortBy }
    }
    */
      const [key, order] = Object.entries(sortBy)[0];
      return operators.reduce(
        input,
        (sorted, cur) => {
          return operators
            .define()
            .let({
              search: operators.reduce(
                sorted,
                (acc, check) => {
                  return operators.cond(
                    operators.and(
                      operators.gt(cur[key], check[key]),
                      operators.not(acc.found)
                    ),
                    () => ({
                      found: true,
                      result: operators.concatArrays(acc.result, [cur, check]),
                    }),
                    () => ({
                      found: acc.found,
                      result: operators.concatArrays(acc.result, [check]),
                    })
                  );
                },
                { found: false, result: [] as typeof input }
              ),
            })
            .return(({ search }) =>
              operators.cond(
                search.found,
                () => search.result,
                () => operators.concatArrays(search.result, [cur])
              )
            );
        },
        [] as typeof input
      );
    },
    trim(input) {
      return {
        $trim: { input },
      } as unknown as string;
    },
    literal(input) {
      return { $literal: input } as typeof input;
    },
  };

  return operators;
};

let handled = new WeakSet();
const stringifyProxies = (value: any) => {
  const recursive = (value: any): any => {
    if (handled.has(value)) {
      return value;
    }
    if (value !== null && typeof value === "object" && "$$ref" in value) {
      return value.$$ref;
    }
    if (Array.isArray(value)) {
      return value.map(recursive);
    }
    if (value !== null && typeof value === "object") {
      if (value instanceof Date) {
        return value;
      }
      if (isObjectId(value)) {
        return value;
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, value]) => [key, recursive(value)])
      );
    }
    return value;
  };
  const result = recursive(value);
  if (result !== null && typeof result === "object") {
    handled.add(result);
  }
  return result;
};
