import {
  Computation,
  Value,
  FlatComputation,
  FieldId,
  FieldImport,
  NestedDocument,
  TemplateFieldId,
} from "../types";
import { symb } from "./symb";

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

export const calculate = (
  id: string,
  compute: Computation,
  getState: (id: FieldId) => Computation | undefined = () => undefined,
  options: {
    returnDefaultValue?: boolean;
  } = {}
) => {
  const result = compute.reduce(
    (acc, el) => {
      let next: Computation = [];

      if (Array.isArray(el) && el[0] === "p") {
        const pick = (el as ["p", TemplateFieldId])[1];

        // next.push(["("]);

        next.push(
          ...acc.value.reduce((acc, el) => {
            return el.reduce((acc, el) => {
              if (el !== null && typeof el === "object") {
                if ("dref" in el) {
                  acc.push({ fref: `${el.dref}${pick}` } as FieldImport);
                } else if ("id" in el && "values" in el && pick in el.values) {
                  acc.push(["("], ...el.values[pick], [")"]);
                }
              }
              return acc;
            }, acc);
          }, [] as Computation)
        );

        // next.push([")"]);

        const latest = acc.stack[acc.stack.length - 1];
        acc.value = latest;
        acc.stack.pop();
      } else {
        next = [el];
      }

      return next.reduce((acc, el) => {
        let next: Computation = [];

        let isImport: FieldImport | false = false;

        if (symb.isImport(el, "field")) {
          const value = calculate(el.fref, getState(el.fref)!, getState);

          next = value.map((x) =>
            symb.isLayoutElement(x) ? { ...x, parent: el.fref } : x
          );

          next.unshift(["("]);
          next.push([")"]);
          // gør ikke noget at wrappe i array. Når det er en funktion,
          // vil den enten selv være wrappet i array eller også vil det
          // være en værdi, så det bliver et single-valued array = værdi,
          // eller også er det wrappet i en funktion, som returnerer et array eller en værdi
          // og der er igen ikke et problem.
          //
          // Den behøvede i princippet ikke blive håndteret her,
          // men værdierne kunne bare tilføjes til acc.value som med args.
          // Men eftersom den netop kan indeholde parametre, skal vi løbe den igennem
          isImport = el;

          // TODO: Hvis den har args, så hent funktion, ellers hent value.
        } else {
          next = [el];
        }

        return next.reduce((acc, el) => {
          acc.func = acc.func.concat([el]);

          if (Array.isArray(el) && typeof el[0] === "number") {
            if (isImport) {
              const arg = getState(`${id}.${isImport.id}/${el[0]}` as FieldId);
              if (arg) {
                acc.value.push(arg);
              } else if (typeof el[1] !== "undefined") {
                acc.value.push([el[1]]);
              }
            } else {
              acc.isFunc = true;
              if (typeof el[1] !== "undefined") {
                acc.value.push([el[1]]);
              }
            }
          } else if (symb.isDBSymbol(el, "n")) {
            // DO NOTHING
          } else if (symb.isDBSymbol(el, "(") || symb.isDBSymbol(el, "{")) {
            acc.stack.push(acc.value);
            acc.value = [];
          } else if (Array.isArray(el) && (el[0] === ")" || el[0] === "}")) {
            const latest = acc.stack[acc.stack.length - 1];
            acc.stack.pop();

            const arr = (() => {
              if (el[0] === "}") {
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
              } else if (!el[1]) {
                return [
                  acc.value.reduce(
                    (acc, cur) => cur.reduce((acc, cur) => [...acc, cur], acc),
                    []
                  ),
                ];
              } else if (el[1] === "sum") {
                return [
                  [
                    acc.value[0].reduce((a: number, op) => {
                      return a + num(op);
                    }, 0),
                  ],
                ];
              } else if (el[1] === "filter") {
                return [
                  acc.value[0].reduce((a, el, index) => {
                    if (acc.value[1][index]) {
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
                            el[1] === "url" ? /[^\w\/\*\-]/g : /[^\w\-]/g
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
                          el[1] === "url" && index !== strings.length - 1
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

            acc.value = latest;
            acc.value.push(...arr);
          } else if (symb.isFetcher(el)) {
            const value = getState(`${id}.${el.id}` as FieldId) ?? [];
            acc.value.push(value);
          } else if (Array.isArray(el)) {
            console.log("HERE HERE 1", el);
            acc.value.push([el[0]]);
          } else {
            acc.value.push([el]);
          }
          return acc;
        }, acc);
      }, acc);
    },
    {
      isFunc: false,
      func: [] as Computation,
      value: [] as Computation[],
      stack: [] as Computation[][],
    }
  );

  const value1 =
    result.isFunc && !options.returnDefaultValue
      ? result.func
      : result.value.reduce((acc, cur) => [...acc, ...cur], []);

  const value2 =
    result.isFunc && !options.returnDefaultValue
      ? result.func
      : result.value.map((cur) => (cur.length === 1 ? cur[0] : cur)); // <-- allows nested arrays.

  return value1 as Value[]; // value.length === 1 ? value[0] : value;
};

const num = (a: unknown, alt: number = 0): number => {
  return typeof a === "number" ? a : alt;
};
const string = (a: unknown): string => {
  return typeof a === "string" || typeof a === "number" ? `${a}` : "";
};
