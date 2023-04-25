import type { FunctionName, Operator, ValueArray } from "./types";

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

export const spreadImplicitArrays = (arr: ValueArray[]) =>
  arr.reduce((acc, cur) => {
    // cur.push(...cur)
    // TODO: Perhaps this function should only do the above.
    // A specific function "single-flat" could take care of flattening single-valued arrays.
    // This function could then be used by "select".
    cur.forEach((el) => {
      if (Array.isArray(el) && el.length === 1) {
        acc.push(el[0]);
      } else {
        acc.push(el);
      }
    });
    return acc;
  }, []);

export const levelImplicitAndExplicitArrays = (
  arr: ValueArray[]
): ValueArray[] => {
  return arr.reduce((acc: ValueArray[], cur) => {
    if (Array.isArray(cur[0])) {
      acc.push(cur[0]);
    } else {
      acc.push(cur);
    }
    return acc;
  }, []);
};

const number = (a: unknown, alt: number = 0): number => {
  return typeof a === "number" ? a : alt;
};

export function compute(
  type: Operator | FunctionName,
  value: ValueArray[]
): ValueArray[] {
  switch (type) {
    case "merge":
      if (value.length === 0) {
        return [[""]];
      } else if (value.length === 1 && value[0].length > 1) {
        // this takes a paragraph consisting of an implicit array
        // and returning it as an explicit array.
        // The implicit array usually originates from a single import with multiple elements.
        return [[value[0]]];
      } else {
        return [
          // ignores implicit arrays
          value.reduce((acc, [cur]) => {
            if (
              typeof acc[acc.length - 1] === "string" &&
              ["string", "number"].includes(typeof cur)
            ) {
              return [...acc.slice(0, -1), `${acc[acc.length - 1]}${cur}`];
            }
            return [...acc, cur] as ValueArray;
          }),
        ];
      }
    case "sum":
      return [
        [
          value[0].reduce((a: number, op) => {
            return a + number(op);
          }, 0),
        ],
      ];
    case "filter":
      const parameters = levelImplicitAndExplicitArrays(value);
      return [
        parameters[0].reduce((a: ValueArray, el, index) => {
          if (parameters[1][index]) {
            a.push(el);
          }
          return a;
        }, []),
      ];
    default:
      break;
  }

  const combinations = levelImplicitAndExplicitArrays(value)
    .reduce(
      (combinations: ValueArray[], array) => {
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
        if (array.length === 0) {
          // TODO empty array is handled as nothing.
          // perhaps not what you would expect?
          return combinations;
        }
        return array.reduce((result: ValueArray[], element) => {
          return result.concat(
            combinations.map((combination) => [...combination, element])
          );
        }, []);
      },
      [[]]
    )
    // FILTER IMPORTANT because you can have operations with no input,
    // which makes reducers below fail. A scenario is when an operation
    // has parameters as inputs with no default value, and it is about
    // to calculate the default value of the function
    .filter((el) => el.length);

  switch (type) {
    case "url":
    case "slug":
      return [
        combinations.map((values) => {
          let strings = values.map((el) =>
            ["number", "string"].includes(typeof el) ? `${el}` : ""
          );
          const string = strings.reduce((acc, string, index) => {
            if (string === "" || (acc === "/" && string === "/")) {
              return acc;
            }

            const matches = Array.from(
              string.matchAll(type === "url" ? /[^\w\/\*\-]/g : /[^\w\-]/g)
            );

            let offset = 0;

            matches.forEach((el) => {
              const match = el[0];
              const anchor = el.index! + offset;
              const focus = anchor + match.length;
              const replacement =
                slugCharacters.find(([char]) => char === match)?.[1] ?? "";
              string =
                string.slice(0, anchor) + replacement + string.slice(focus);
              offset += replacement.length - match.length;
            });

            return `${acc}${string.toLowerCase()}`;
          }, "");
          return string;
        }),
      ];
    case "in":
      return [
        [
          combinations.reduce((acc, op) => {
            return acc || op[0] === op[1];
          }, false),
        ],
      ];
    case "concat":
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
    case "=":
      return [
        combinations.map((op) => {
          return op[0] === op[1];
        }),
      ];
    case "+":
      return [
        combinations
          .map((values) => {
            return values.reduce((a, c) => number(a) + number(c)) as number;
          })
          .flat(1),
      ];
    case "-":
      return [
        combinations
          .map((values) => {
            return values.reduce((a, c) => number(a) - number(c)) as number;
          })
          .flat(1),
      ];
    case "*":
      return [
        combinations
          .map((values) => {
            return values.reduce(
              (a, c) => number(a, 1) * number(c, 1)
            ) as number;
          })
          .flat(1),
      ];
    case "/":
      return [
        combinations
          .map((values) => {
            return values.reduce(
              (a, c) => number(a, 1) / number(c, 1)
            ) as number;
          })
          .flat(1),
      ];
    case "&":
      return [
        combinations
          .map((values) => {
            return values.reduce((a, c) => Boolean(a && c));
          })
          .flat(1),
      ];
    case "|":
      return [
        combinations
          .map((values) => {
            return values.reduce((a, c) => Boolean(a || c));
          })
          .flat(1),
      ];
    default:
      return combinations;
  }
}
