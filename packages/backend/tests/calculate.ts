import {
  Value,
  FieldId,
  FieldImport,
  TemplateFieldId,
  Operator,
  FunctionName,
  Fetcher,
  PrimitiveValue,
  DocumentImport,
  FlatFieldImport,
  FlatValue,
} from "../types";
import { symb } from "./symb";

/*
The accummulator value would in principle look like this:
[1, 2, 3, [4, 5], 6, 7

If the element [4, 5] was the direct result of an import however, it would end up looking like this:
[1, 2, 3, 4, 5, 6, 7]

This spreading of the import is the correct behavior for top level imports. If the import was intended to be an array,
the import should be wrapped in an array.

But when it is imported as a parameter to a function, sometimes we want the import to be treated as an array and not spread.
This is the case when the function is "in" or "filter".

We can accommodate this variable behavior by accummulating values in the following manner:
[[1], [2], [3], [[4, 5]], [6], [7]]

If the element [[4, 5]] was the direct result of an import, it would end up looking like this:
[[1], [2], [3], [4, 5], [6], [7]]

This introduces the concept of an "implicit array".
Then functions can themselves decide whether to treat the implicit array as an array or not.

For instance: sum would not treat the implicit array as an array, and return 28.

Imports and results of functions return implicit arrays.
A closing normal bracket constructs an implicit array of its elements. (so we can wrap imports in normal brackets).
- TODO perhaps also "normalizes" it by flattening single-valued arrays.
A closing square bracket spreads the contents from the implicit array into the explicit array.

filter([1, 2, 3], [1, 2, 3]=1);

filter([1, 2, 3], [1, 2, 3]=1);

parameters are: [[[1, 2, 3]], [true, false, false]]
with keep, it becomes: [[1, 2, 3], [true, false, false]]

lets do an import
const imp = [1, 2, 3]
filter(imp, [1, 2, 3]=1);

parameters are: [[1, 2, 3], [true, false, false]]
with keep it becomes: [[1, 2, 3], [true, false, false]]

lets do a nested import
const imp = [1, 2, 3]
filter([0, imp, 4, 5], [1, 2, 3]=1);
parameters are: [[0, 1, 2, 3, 4, 5], [true, false, false]] (since square brackets spreads the implicit array from the import)
*/

const spreadImplicitArrays = (arr: Value[][]) =>
  arr.reduce((acc, cur) => {
    // cur.push(...cur)
    // TODO: Perhaps this function should only do the above.
    // A specific function "single-flat" could take care of flattening single-valued arrays.
    // This function could then be used by "pick".
    cur.forEach((el) => {
      if (Array.isArray(el) && el.length === 1) {
        acc.push(el[0]);
      } else {
        acc.push(el);
      }
    });
    return acc;
  }, []);

const keepImplicitArrays = (arr: Value[][]) =>
  arr.reduce((acc, cur) => {
    if (cur.length === 1) {
      acc.push(...cur);
    } else {
      acc.push(cur);
    }
    return acc;
  }, []);

const levelImplicitAndExplicitArrays = (arr: Value[][]): Value[][] => {
  return arr.reduce((acc: Value[][], cur) => {
    if (Array.isArray(cur[0])) {
      acc.push(cur[0]);
    } else {
      acc.push(cur);
    }
    return acc;
  }, []);
};

export type Parameter = { x: number; value?: PrimitiveValue };

export type PlaceholderNext = Parameter | FieldImport | Fetcher;

export type FlatPlaceholderNext =
  | Parameter
  | DocumentImport
  | FlatFieldImport
  | Fetcher;

export type SharedSymbolNext =
  | { "(": true }
  | { ")": true }
  | { "[": true }
  | { "]": true }
  | { n: true };

type SharedSymbolKey = "(" | ")" | "[" | "]" | "n";
type EditorSymbolKey = SharedSymbolKey | "_" | ",";
export type DBSymbolKey = SharedSymbolKey | "{" | "}" | "p";

export type EditorSymbolNext =
  | SharedSymbolNext
  | { _: Operator }
  | { ")": FunctionName }
  | { ",": true };

export type DBSymbol =
  | SharedSymbolNext
  | { "{": true }
  | { "}": true }
  | { ")": Operator | FunctionName }
  | { p: TemplateFieldId };

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

export type Computation = (Value | PlaceholderNext | DBSymbol)[];
export type FlatComputation = (FlatValue | FlatPlaceholderNext | DBSymbol)[];

type Loop<T extends Record<string, any> | undefined = undefined> = {
  index: number;
  array: Computation;
  resolved: boolean;
} & (T extends undefined ? { vars?: never } : { vars: T });

type ThenableAsync = {
  then: (
    callback: (value: Value[]) => Value[] | PromiseLike<Value[]>
  ) => Promise<Value[]>;
};

type ThenableSync = {
  then: (callback: (value: Value[]) => Value[]) => Value[];
};

type Accumulator = {
  isFunc: boolean;
  func: Computation;
  value: Value[][];
  stack: Value[][][];
  loop1: Loop;
  loop2: Loop<{
    args: (ThenableAsync | undefined)[] | (ThenableSync | undefined)[];
  }>;
  loop3: Loop;
};

const toArray = (value: Value | Value[]) =>
  Array.isArray(value) ? value : [value];

export function calculate(
  id: string,
  compute: Computation,
  getState: (id: string, returnFunction?: boolean) => ThenableAsync | undefined,
  options?: {
    returnFunction?: boolean;
    acc?: Accumulator;
  }
): Value[] | Promise<Value[]>;
export function calculate(
  id: string,
  compute: Computation,
  getState: (id: string, returnFunction?: boolean) => ThenableSync | undefined,
  options?: {
    returnFunction?: boolean;
    acc?: Accumulator;
  }
): Value[];
export function calculate(
  id: string,
  compute: Computation,
  getState: (
    id: string,
    returnFunction?: boolean
  ) => ThenableAsync | ThenableSync | undefined,
  options: {
    returnFunction?: boolean;
    acc?: Accumulator;
  } = {}
): Value[] | Promise<Value[]> {
  let acc: Accumulator = options.acc ?? {
    isFunc: false,
    func: [],
    value: [],
    stack: [],
    loop1: {
      index: 0,
      array: compute,
      resolved: false,
    },
    loop2: {
      index: 0,
      array: [],
      resolved: false,
      vars: {
        args: [],
      },
    },
    loop3: {
      index: 0,
      array: [],
      resolved: false,
    },
  };

  for (; acc.loop1.index < acc.loop1.array.length; acc.loop1.index += 1) {
    if (!acc.loop1.resolved) {
      acc.loop1.resolved = true;
      const el = acc.loop1.array[acc.loop1.index];

      acc.loop2.array = [];
      acc.loop2.index = 0;

      if (symb.isDBSymbol(el, "p")) {
        const pick = el.p;

        acc.loop2.array.push({ "(": true });

        acc.loop2.array.push(
          ...acc.value.reduce((acc, el) => {
            return el.reduce((acc, el) => {
              if (el !== null && typeof el === "object") {
                if ("dref" in el) {
                  acc.push(
                    { "[": true },
                    {
                      fref: `${el.dref}${pick}`,
                    } as FieldImport,
                    {
                      "]": true,
                    }
                  );
                } else if ("id" in el && "values" in el && pick in el.values) {
                  acc.push({ "[": true }, ...(el.values[pick] as any), {
                    "]": true,
                  });
                }
              }
              return acc;
            }, acc);
          }, [] as Computation)
        );

        acc.loop2.array.push({ ")": true });

        const latest = acc.stack[acc.stack.length - 1];
        acc.value = latest;
        acc.stack.pop();
      } else {
        acc.loop2.array = [el];
      }
    }

    for (; acc.loop2.index < acc.loop2.array.length; acc.loop2.index += 1) {
      if (!acc.loop2.resolved) {
        acc.loop2.resolved = true;
        const el = acc.loop2.array[acc.loop2.index];

        acc.loop3.array = [];
        acc.loop3.index = 0;

        acc.loop2.vars.args = [];

        if (symb.isFieldImport(el)) {
          const args = [0, 1, 2].map((index) => {
            const fieldId = `${id}.${el.id}/${index}`;
            return getState(fieldId);
          }) as ThenableAsync[] | ThenableSync[];

          const hasArgs = args.some((el) => el !== undefined);

          const state = getState(el.fref, hasArgs);

          if (state) {
            return state.then((value) => {
              if (hasArgs) {
                acc.loop3.array = value.map((x) =>
                  symb.isLayoutElement(x) ? { ...x, parent: el.fref } : x
                );

                acc.loop3.array.unshift({ "(": true });
                acc.loop3.array.push({ ")": true });

                acc.loop2.vars.args = args;

                return calculate(id, compute, getState as any, {
                  ...options,
                  acc,
                }) as Value[];
              } else {
                // or return default value
                acc.value.push(value); // implicit array
                acc.loop2.index++;
                acc.loop2.resolved = false;

                return calculate(id, compute, getState as any, {
                  ...options,
                  acc,
                }) as Value[];
              }
            });
          }
        } else {
          acc.loop3.array = [el];
        }
      }

      const { args } = acc.loop2.vars;

      for (; acc.loop3.index < acc.loop3.array.length; acc.loop3.index += 1) {
        const el = acc.loop3.array[acc.loop3.index];
        acc.func = acc.func.concat([el]);

        if (symb.isParameter(el)) {
          const argThenable = args[el.x];
          if (argThenable) {
            return argThenable.then((arg) => {
              if (arg) {
                acc.value.push(arg); // implicit array
              } else if (typeof el.value !== "undefined") {
                acc.value.push([el.value]);
              }
              acc.loop3.index++;
              return calculate(id, compute, getState as any, {
                ...options,
                acc,
              }) as Value[];
            });
          } else {
            acc.isFunc = true;
            if (typeof el.value !== "undefined") {
              acc.value.push([el.value]);
            }
          }
        } else if (symb.isDBSymbol(el, "n")) {
          // DO NOTHING
        } else if (
          symb.isDBSymbol(el, "(") ||
          symb.isDBSymbol(el, "{") ||
          symb.isDBSymbol(el, "[")
        ) {
          acc.stack.push(acc.value);
          acc.value = [];
        } else if (symb.isDBSymbol(el, ")") && el[")"] === true) {
          const latest = acc.stack[acc.stack.length - 1];
          acc.stack.pop();
          acc.value = latest.concat([spreadImplicitArrays(acc.value)]);
        } else if (
          symb.isDBSymbol(el, ")") ||
          symb.isDBSymbol(el, "}") ||
          symb.isDBSymbol(el, "]")
        ) {
          const latest = acc.stack[acc.stack.length - 1];
          acc.stack.pop();
          acc.value = latest.concat(
            (() => {
              if ("}" in el) {
                return [
                  acc.value.reduce(
                    (acc, cur) =>
                      cur.reduce((acc, cur, index) => {
                        if (
                          index === 0 && // <-- this protects array boundaries within imports
                          typeof acc[acc.length - 1] === "string" &&
                          ["string", "number"].includes(typeof cur)
                        ) {
                          return [
                            ...acc.slice(0, -1),
                            `${acc[acc.length - 1]}${cur}`,
                          ];
                        }
                        return [...acc, cur] as FlatComputation;
                      }, acc),
                    [""] as FlatComputation
                  ),
                ];
              } else if ("]" in el) {
                return [[spreadImplicitArrays(acc.value)]];
              } else if (el[")"] === "sum") {
                return [
                  [
                    acc.value[0].reduce((a: number, op) => {
                      return a + num(op);
                    }, 0),
                  ],
                ];
              } else if (el[")"] === "filter") {
                const parameters = levelImplicitAndExplicitArrays(acc.value);
                return [
                  parameters[0].reduce((a, el, index) => {
                    if (parameters[1][index]) {
                      a.push(el);
                    }
                    return a;
                  }, [] as Computation),
                ];
              }

              const combinations = levelImplicitAndExplicitArrays(acc.value)
                .reduce(
                  (combinations, array) => {
                    //

                    // for each element in array, copy all current combinations with element appended

                    // [[5], [4], [3], [2]] = [[5, 4, 3, 2]]
                    // [[5], [4], [3, 2]] = [[5, 4, 3], [5, 4, 2]]
                    // [[5, 4], [3, 2]] = [[5, 3], [5, 2], [4, 3], [4, 2]]
                    // - we begin with combinations = []
                    // - adds [5]: [[5]],
                    // - adds [4]: [[5], [4]],
                    // - now combinations = [[5], [4]] to which new elements are added
                    // - adds [3]: [[5, 3], [4, 3]]
                    // - adds [2]: [[4, 3], [4, 3], [5, 2], [4, 2]]
                    return array.reduce((result, element) => {
                      return result.concat(
                        combinations.map((combination) => [
                          ...combination,
                          element,
                        ])
                      );
                    }, [] as Computation[]);
                  },
                  [[]] as Computation[]
                )
                // FILTER IMPORTANT because you can have operations with no input,
                // which makes reducers below fail. A scenario is when an operation
                // has parameters as inputs with no default value, and it is about
                // to calculate the default value of the function
                .filter((el) => el.length);

              if (el[")"] === "in") {
                return [
                  [
                    combinations.reduce((acc, op) => {
                      return acc || op[0] === op[1];
                    }, false),
                  ],
                ];
              } else if (el[")"] === "concat") {
                return [
                  combinations.reduce((a, values) => {
                    return [
                      ...a,
                      ...values
                        .reduce((a, c) => {
                          if (
                            ["number", "string"].includes(typeof c) &&
                            ["number", "string"].includes(typeof a[0])
                          ) {
                            return [`${a[0]}${c}`, ...a.slice(1)];
                          }
                          return [c, ...a];
                        }, [] as any[])
                        .reverse(),
                    ];
                  }, [] as any[]),
                ];
                /*
              return [
                combinations.map((values) => {
                  return values.reduce((a, c) => {
                    return `${string(a)}${string(c)}`;
                  });
                }),
              ];
              */
              } else if (el[")"] === "url" || el[")"] === "slug") {
                return [
                  combinations.map((values) => {
                    let strings = values.map((el) =>
                      ["number", "string"].includes(typeof el)
                        ? (el as string)
                        : ""
                    );
                    return strings
                      .map((string, index) => {
                        if (string === "") {
                          return "";
                        }
                        const matches = Array.from(
                          string.matchAll(
                            el[")"] === "url" ? /[^\w\/\*\-]/g : /[^\w\-]/g
                          )
                        );

                        let offset = 0;

                        matches.forEach((el) => {
                          const match = el[0];
                          const anchor = el.index! + offset;
                          const focus = anchor + match.length;
                          const replacement =
                            slugCharacters.find(
                              ([char]) => char === match
                            )?.[1] ?? "";
                          string =
                            string.slice(0, anchor) +
                            replacement +
                            string.slice(focus);
                          offset += replacement.length - match.length;
                        });

                        return `${string.toLowerCase()}${
                          el[")"] === "url" && index !== strings.length - 1
                            ? "/"
                            : ""
                        }`;
                      })
                      .join("");
                  }),
                ];
              } else if (el[")"] === "=") {
                return [
                  combinations.map((op) => {
                    return op[0] === op[1];
                  }),
                ];
              } else if (el[")"] === "+") {
                return [
                  combinations
                    .map((values) => {
                      return values.reduce((a, c) => num(a) + num(c)) as number;
                    })
                    .flat(1),
                ];
              } else if (el[")"] === "-") {
                return [
                  combinations
                    .map((values) => {
                      return values.reduce((a, c) => num(a) - num(c)) as number;
                    })
                    .flat(1),
                ];
              } else if (el[")"] === "*") {
                return [
                  combinations
                    .map((values) => {
                      return values.reduce(
                        (a, c) => num(a, 1) * num(c, 1)
                      ) as number;
                    })
                    .flat(1),
                ];
              } else if (el[")"] === "/") {
                return [
                  combinations
                    .map((values) => {
                      return values.reduce(
                        (a, c) => num(a, 1) / num(c, 1)
                      ) as number;
                    })
                    .flat(1),
                ];
              } else {
                return combinations;
              }
            })()
          );
        } else if (symb.isFetcher(el)) {
          const state = getState(`${id}.${el.id}` as FieldId);
          if (state) {
            return state.then((value) => {
              acc.value.push(value);
              acc.loop3.index++;
              return calculate(id, compute, getState as any, {
                ...options,
                acc,
              }) as Value[];
            });
          }
        } else {
          acc.value.push([el as Exclude<Value, FieldImport>]);
        }

        acc.loop3.resolved = false;
      }
      acc.loop2.resolved = false;
    }
    acc.loop1.resolved = false;
  }

  const value =
    acc.isFunc && options.returnFunction
      ? acc.func
      : acc.value.reduce((acc, cur) => [...acc, ...cur], []);

  return value as Value[];
}

const num = (a: unknown, alt: number = 0): number => {
  return typeof a === "number" ? a : alt;
};
const string = (a: unknown): string => {
  return typeof a === "string" || typeof a === "number" ? `${a}` : "";
};
