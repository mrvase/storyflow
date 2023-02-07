import {
  Computation,
  Value,
  FlatComputation,
  FieldId,
  FieldImport,
  TemplateFieldId,
} from "../types";
import { symb } from "../symb";

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

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
  value: Value[];
  stack: Value[][];
  loop1: Loop;
  loop2: Loop<{
    args: (ThenableAsync | undefined)[] | (ThenableSync | undefined)[];
  }>;
  loop3: Loop;
};

const toArray = (value: Value | Value[]) =>
  Array.isArray(value) ? value : [value];

export function calculateAsync(
  id: string,
  compute: Computation,
  getState: (id: string, returnFunction?: boolean) => ThenableAsync | undefined,
  options?: {
    returnFunction?: boolean;
    acc?: Accumulator;
  }
): Value[] | Promise<Value[]>;
export function calculateAsync(
  id: string,
  compute: Computation,
  getState: (id: string, returnFunction?: boolean) => ThenableSync | undefined,
  options?: {
    returnFunction?: boolean;
    acc?: Accumulator;
  }
): Value[];
export function calculateAsync(
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

      if (Array.isArray(el) && el[0] === "p") {
        const pick = (el as ["p", TemplateFieldId])[1];

        acc.loop2.array.push(["["]);

        acc.loop2.array.push(
          ...acc.value.reduce((acc, el) => {
            return toArray(el).reduce((acc, el) => {
              if (el !== null && typeof el === "object") {
                if ("dref" in el) {
                  acc.push({ fref: `${el.dref}${pick}` } as FieldImport);
                } else if ("id" in el && "values" in el && pick in el.values) {
                  acc.push(...el.values[pick]);
                }
              }
              return acc;
            }, acc);
          }, [] as Computation)
        );

        acc.loop2.array.push(["]"]);

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

        if (symb.isImport(el, "field")) {
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

                /*
                acc.loop3.array.unshift(["("]);
                acc.loop3.array.push([")"]);
                */

                // gør ikke noget at wrappe i array. Når det er en funktion,
                // vil den enten selv være wrappet i array eller også vil det
                // være en værdi, så det bliver et single-valued array = værdi,
                // eller også er det wrappet i en funktion, som returnerer et array eller en værdi
                // og der er igen ikke et problem.
                acc.loop2.vars.args = args;

                return calculateAsync(id, compute, getState as any, {
                  ...options,
                  acc,
                }) as Value[];
              } else {
                // or return default value
                acc.value.push(...value);
                acc.loop2.index++;
                acc.loop2.resolved = false;

                return calculateAsync(id, compute, getState as any, {
                  ...options,
                  acc,
                }) as Value[];
              }
            });
          }

          // TODO: Hvis den har args, så hent funktion, ellers hent value.
        } else {
          acc.loop3.array = [el];
        }
      }

      const { args } = acc.loop2.vars;

      for (; acc.loop3.index < acc.loop3.array.length; acc.loop3.index += 1) {
        const el = acc.loop3.array[acc.loop3.index];
        acc.func = acc.func.concat([el]);

        if (Array.isArray(el) && typeof el[0] === "number") {
          const argThenable = args[el[0]];
          if (argThenable) {
            return argThenable.then((arg) => {
              if (arg) {
                acc.value.push(...arg);
              } else if (typeof el[1] !== "undefined") {
                acc.value.push(el[1]);
              }
              acc.loop3.index++;
              return calculateAsync(id, compute, getState as any, {
                ...options,
                acc,
              }) as Value[];
            });
          } else {
            acc.isFunc = true;
            if (typeof el[1] !== "undefined") {
              acc.value.push([el[1]]);
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
        } else if (Array.isArray(el) && el[0] === ")" && !el[1]) {
          const latest = acc.stack[acc.stack.length - 1];
          acc.stack.pop();

          latest.push(...acc.value);
          acc.value = latest;
        } else if (
          Array.isArray(el) &&
          (el[0] === ")" || el[0] === "}" || el[0] === "]")
        ) {
          const latest = acc.stack[acc.stack.length - 1];
          acc.stack.pop();

          const arr = (() => {
            if (el[0] === "}") {
              return [
                acc.value.reduce(
                  (acc, cur) =>
                    toArray(cur).reduce((acc, cur, index) => {
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
            } else if (el[0] === "]") {
              return [[acc.value]];
            } else if (el[1] === "sum") {
              return [
                [
                  toArray(acc.value[0]).reduce((a: number, op) => {
                    return a + num(op);
                  }, 0),
                ],
              ];
            } else if (el[1] === "filter") {
              return [
                toArray(acc.value[0]).reduce((a, el, index) => {
                  if (toArray(acc.value[1])[index]) {
                    a.push(el);
                  }
                  return a;
                }, [] as Computation),
              ];
            }

            const combinations = acc.value
              .reduce(
                (combinations, array) => {
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
                  return toArray(array).reduce((result, element) => {
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

            if (el[1] === "in") {
              return [
                [
                  combinations.reduce((acc, op) => {
                    return acc || op[0] === op[1];
                  }, false),
                ],
              ];
            } else if (el[1] === "concat") {
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
            } else if (el[1] === "url" || el[1] === "slug") {
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
                          (el as any[])[1] === "url"
                            ? /[^\w\/\*\-]/g
                            : /[^\w\-]/g
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
                        (el as any[])[1] === "url" &&
                        index !== strings.length - 1
                          ? "/"
                          : ""
                      }`;
                    })
                    .join("");
                }),
              ];
            } else if (el[1] === "=") {
              return [
                combinations.map((op) => {
                  return op[0] === op[1];
                }),
              ];
            } else if (el[1] === "+") {
              return [
                combinations
                  .map((values) => {
                    return values.reduce((a, c) => num(a) + num(c)) as number;
                  })
                  .flat(1),
              ];
            } else if (el[1] === "-") {
              return [
                combinations
                  .map((values) => {
                    return values.reduce((a, c) => num(a) - num(c)) as number;
                  })
                  .flat(1),
              ];
            } else if (el[1] === "*") {
              return [
                combinations
                  .map((values) => {
                    return values.reduce(
                      (a, c) => num(a, 1) * num(c, 1)
                    ) as number;
                  })
                  .flat(1),
              ];
            } else if (el[1] === "/") {
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
          })();

          const nestedArray = arr.length === 1 ? arr[0] : arr;

          acc.value = latest;
          acc.value.push(...nestedArray);
        } else if (symb.isFetcher(el)) {
          const state = getState(`${id}.${el.id}` as FieldId);
          if (state) {
            return state.then((value) => {
              acc.value.push(value);
              acc.loop3.index++;
              return calculateAsync(id, compute, getState as any, {
                ...options,
                acc,
              }) as Value[];
            });
          }
        } else {
          acc.value.push(el as any);
        }

        acc.loop3.resolved = false;
      }
      acc.loop2.resolved = false;
    }
    acc.loop1.resolved = false;
  }

  const value = acc.isFunc && options.returnFunction ? acc.func : acc.value;

  return value as Value[];
}

const num = (a: unknown, alt: number = 0): number => {
  return typeof a === "number" ? a : alt;
};
const string = (a: unknown): string => {
  return typeof a === "string" || typeof a === "number" ? `${a}` : "";
};
