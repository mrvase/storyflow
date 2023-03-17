import { createFieldId } from "./ids";
import { tokens } from "./tokens";
import {
  LineBreak,
  NestedFolder,
  Parameter,
  SyntaxTree,
  ValueArray,
  WithSyntaxError,
  ContextToken,
  DocumentId,
  FieldId,
  FolderId,
  FunctionName,
  NestedDocumentId,
  NestedField,
  Operator,
  RawFieldId,
  SortSpec,
  TreeRecord,
} from "./types";

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

export type FetchObject = {
  id: NestedDocumentId;
  folder: FolderId;
  limit: number;
  select: RawFieldId;
  sortBy?: SortSpec;
};

type Importers = FieldId | FetchObject | ContextToken;

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

const spreadImplicitArrays = (arr: ValueArray[]) =>
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

const levelImplicitAndExplicitArrays = (arr: ValueArray[]): ValueArray[] => {
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

function compute(
  type: Operator | FunctionName | "merge",
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
          return strings
            .map((string, index) => {
              if (string === "") {
                return "";
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

              return `${string.toLowerCase()}${
                type === "url" && index !== strings.length - 1 ? "/" : ""
              }`;
            })
            .join("");
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

export type StateGetter = {
  (id: Importers, options: { tree: true; external?: boolean }):
    | SyntaxTree
    | undefined;
  (id: Importers, options: { tree: boolean; external?: boolean }):
    | SyntaxTree
    | ValueArray
    | undefined;
  (id: Importers, options: { tree?: undefined; external?: boolean }):
    | ValueArray
    | undefined;
};

export function calculate(node: SyntaxTree, getState: StateGetter): ValueArray {
  const calculateNode = (
    node: SyntaxTree,
    args?: (ValueArray | undefined)[]
  ): ValueArray[] => {
    let result: ValueArray[] = node.children.reduce(
      (acc: ValueArray[], child) => {
        if (typeof child === "object" && "type" in child) {
          // håndterer noget i paranteser
          acc.push(...calculateNode(child));
        } else if (tokens.isNestedField(child)) {
          const args =
            "id" in child
              ? [0, 1, 2].map((index) => {
                  const fieldId = createFieldId(
                    index,
                    child.id as unknown as DocumentId
                  );
                  return getState(fieldId, { external: false });
                })
              : []; // not the case when resulting from select

          const hasArgs = args.some((el) => el !== undefined);

          const state = getState(child.field, {
            tree: hasArgs,
          });

          if (state) {
            if (hasArgs) {
              acc.push(calculateNode(state as SyntaxTree, args));
            } else {
              acc.push(state as ValueArray);
            }
          }
        } else if (tokens.isContextToken(child)) {
          const state = getState(child, { tree: true, external: false });
          if (state) {
            acc.push(calculateNode(state));
          }
        } else if (tokens.isParameter(child)) {
          const arg = args && args[child.x];
          if (arg) {
            acc.push([arg]);
          } else if (typeof child.value !== "undefined") {
            acc.push([child.value]);
          }
        } else if (tokens.isLineBreak(child)) {
          // do nothing
        } else if (typeof child === "object" && "select" in child) {
          const child_: NestedFolder & { select: RawFieldId } = child as any;

          const state = getState(
            {
              id: child_.id,
              folder: child_.folder,
              limit: 10,
              select: child_.select,
            },
            {
              external: true,
            }
          );

          if (state) {
            acc.push([state]);
          }
        } else if (
          typeof child === "object" &&
          ("missing" in child || "error" in child)
        ) {
          // do nothing
        } else {
          acc.push([
            child as Exclude<
              typeof child,
              Parameter | LineBreak | unknown[] | WithSyntaxError
            >,
          ]);
        }
        return acc;
      },
      []
    );

    // run function

    if (node.type === "select") {
      const select = node.payload!.select as RawFieldId;
      let next: SyntaxTree = {
        type: null,
        children: result.reduce((acc: SyntaxTree["children"], el) => {
          if (tokens.isNestedFolder(el)) {
            acc.push({
              type: null,
              children: [{ ...el, select: select } as NestedFolder],
            });
          } else if (tokens.isNestedDocument(el)) {
            acc.push({
              type: null,
              children: [
                {
                  field: `${el.id.slice(12, 24)}${select}`,
                } as NestedField,
              ],
            });
          }
          acc.push(el);
          return acc;
        }, []),
      };
      result = [calculate(next, getState)];
    }

    if (node.type === ("array" as any)) {
      result = [[spreadImplicitArrays(result)]];
    } else if (node.type === null) {
      // brackets
      result = [spreadImplicitArrays(result)];
    } else {
      result = compute(
        node.type as Exclude<typeof node.type, "select" | "array" | null>,
        result
      );
    }

    return result;
  };

  const value = calculateNode(node);

  return value.reduce((acc, cur) => [...acc, ...cur], []);
}

export function calculateFromRecord(id: FieldId, record: TreeRecord) {
  const getter: StateGetter = (id, { external, tree }): any => {
    if (typeof id === "object") {
      return [];
    }
    const value = record[id];
    if (!value) return;
    if (tree) return value;
    return calculate(value, getter);
  };

  const tree = record[id];

  if (!tree) return [];

  return calculate(tree, getter);
}
