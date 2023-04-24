import { computeFieldId, createFieldId } from "./ids";
import { tokens } from "./tokens";
import {
  NestedFolder,
  SyntaxTree,
  ValueArray,
  ContextToken,
  DocumentId,
  FieldId,
  FunctionName,
  Operator,
  SyntaxTreeRecord,
  NestedDocument,
  GetFunctionData,
  Sorting,
  ClientSyntaxTree,
  StateToken,
} from "./types";
import { isSyntaxTree } from "./syntax-tree";

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

export type FolderFetch = {
  folder: NestedFolder;
  limit: number;
  sort?: Sorting[];
};

type Importer = FieldId | FolderFetch | ContextToken;

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

export type StateGetter = {
  (id: Importer, options: { tree: true; external?: boolean }):
    | SyntaxTree
    | undefined;
  (id: Importer, options: { tree: boolean; external?: boolean }):
    | SyntaxTree
    | ClientSyntaxTree
    | ValueArray
    | undefined;
  (id: Importer, options: { tree?: undefined; external?: boolean }):
    | ClientSyntaxTree
    | ValueArray
    | undefined;
};

type Context = {
  args?: (ValueArray | ClientSyntaxTree | undefined)[];
  select?: boolean;
};

const resolveChildren = (
  children: SyntaxTree<any>["children"],
  getState: StateGetter,
  calculateNode: (
    node: SyntaxTree<any>,
    context?: Context
  ) => ValueArray[] | ClientSyntaxTree,
  context: Context = {},
  ignoreClientState?: boolean
) => {
  let acc: (ValueArray | ClientSyntaxTree)[] = [];
  let isClientState = false;

  children.forEach((child) => {
    if (isSyntaxTree(child)) {
      // håndterer noget i paranteser
      const result = calculateNode(child);
      if (Array.isArray(result)) {
        acc.push(...result);
      } else {
        acc.push(result);
      }
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

      const hasArgs = args.some(
        (el) => el !== undefined && (!Array.isArray(el) || el.length > 0)
      );

      const state = getState(child.field, {
        tree: hasArgs,
        external: true,
      });

      if (state) {
        if (hasArgs) {
          const result = calculateNode(state as SyntaxTree, {
            args,
          });
          if (Array.isArray(result)) {
            acc.push(...result);
          } else {
            acc.push(result);
          }
        } else if ((state as ValueArray).length > 0) {
          acc.push(state as ValueArray);
        }
      }
    } else if (tokens.isStateToken(child)) {
      if (!ignoreClientState) {
        isClientState = true;
        acc.push([child]);
      }
    } else if (tokens.isContextToken(child)) {
      const state = getState(child, { external: false });
      if (state) {
        acc.push(state);
      }
    } else if (tokens.isParameter(child)) {
      const arg = context.args && context.args[child.x];
      if (arg) {
        acc.push(Array.isArray(arg) ? [arg] : arg);
      } else if (typeof child.value !== "undefined") {
        acc.push([child.value]);
      }
    } else if (tokens.isLineBreak(child)) {
      // do nothing
    } else if (
      typeof child === "object" &&
      ("missing" in child || "error" in child)
    ) {
      // do nothing
    } else {
      acc.push([child]);
    }
  });

  return { children: acc, isClientState };
};

export function calculate(
  node: SyntaxTree,
  getState: StateGetter,
  options: { ignoreClientState: true }
): ValueArray;
export function calculate(
  node: SyntaxTree,
  getState: StateGetter,
  options?: { ignoreClientState?: false }
): ValueArray | ClientSyntaxTree;
export function calculate(
  node: SyntaxTree,
  getState: StateGetter,
  options?: { ignoreClientState?: boolean }
): ValueArray | ClientSyntaxTree {
  const calculateNode = (
    node: SyntaxTree,
    context: {
      args?: (ValueArray | ClientSyntaxTree | undefined)[];
    } = {}
  ): ValueArray[] | ClientSyntaxTree => {
    let { children, isClientState } = resolveChildren(
      node.children,
      getState,
      calculateNode,
      context,
      options?.ignoreClientState
    );

    const clientFunctions = ["loop"];

    // run function

    /*
      Hvis den indeholder ClientSyntaxTree, returner
    */
    if (
      isClientState ||
      children.some((el) => !Array.isArray(el)) ||
      (node.type && clientFunctions.includes(node.type))
    ) {
      return {
        ...node,
        children,
      } as ClientSyntaxTree;
    }

    let values = children as ValueArray[];

    if (node.type === "fetch") {
      const [limit, ...sort] = node.data as GetFunctionData<"fetch">;

      let docs = spreadImplicitArrays(values).reduce(
        (acc: NestedDocument[], el) => {
          if (tokens.isNestedFolder(el)) {
            const state = getState(
              {
                folder: el,
                limit,
              },
              {
                external: true,
              }
            );
            if (state) {
              acc.push(...(state as NestedDocument[]));
            }
          } else if (tokens.isNestedDocument(el)) {
            acc.push(el);
          }
          return acc;
        },
        []
      );

      Object.entries(sort).forEach(([rawFieldId, direction]) => {
        docs = docs.sort((a, b) => {
          // get state for each field
          return 0;
        });
      });

      values = [docs.slice(0, limit)];
    } else if (node.type === "select") {
      const select = node.data as GetFunctionData<"select">;

      values = [
        spreadImplicitArrays(
          spreadImplicitArrays(values).reduce((acc: ValueArray[], el) => {
            if (tokens.isNestedDocument(el)) {
              const state = getState(computeFieldId(el.id, select), {
                external: true,
              });

              if (state) {
                /*
                TODO
                It is only possible right now to have a NestedField inside a select function.
                This refers to a field that has documents or folders as children.
                These can depend on client state. To handle this, we have to do something special.
                */
                acc.push([state as ValueArray]);
              }
            }
            return acc;
          }, [])
        ),
      ];
    } else if (node.type === "root") {
      // do nothing
    } else if (node.type === null) {
      // brackets
      values = [spreadImplicitArrays(values)];
    } else if (node.type === "array") {
      values = [[spreadImplicitArrays(values)]];
    } else {
      values = compute(
        node.type as Exclude<
          typeof node.type,
          "select" | "fetch" | "array" | "root" | null
        >,
        values
      );
    }

    return values;
  };

  const value = calculateNode(node);

  if (Array.isArray(value)) {
    return value.reduce((acc, cur) => [...acc, ...cur], []);
  }

  return value;
}

export function calculateRootFieldFromRecord(
  id: FieldId,
  record: SyntaxTreeRecord
) {
  const getter: StateGetter = (id, { external, tree }): any => {
    if (typeof id === "object") {
      return [];
    }
    const value = record[id];
    if (!value) return;
    if (tree) return value;
    return calculate(value, getter, { ignoreClientState: true });
  };

  const tree = record[id];

  if (!tree) return [];

  const result = calculate(tree, getter, { ignoreClientState: true });
  if (!Array.isArray(result)) {
    throw new Error(
      "It should not be possible to have client state in root field"
    );
  }
  return result;
}

const resolveClientChildren = (
  children: ClientSyntaxTree["children"],
  getState: (token: StateToken) => ValueArray[number],
  calculateNode: (node: ClientSyntaxTree) => ValueArray[]
) => {
  let acc: ValueArray[] = [];

  children.forEach((child) => {
    if (isSyntaxTree(child)) {
      // håndterer noget i paranteser
      const result = calculateNode(child);
      if (Array.isArray(result)) {
        acc.push(...result);
      } else {
        acc.push(result);
      }
    } else if (tokens.isStateToken(child)) {
      const state = getState(child);
      acc.push([state]);
    } else {
      acc.push([child]);
    }
  });

  return acc;
};

export function calculateClient(
  node: ClientSyntaxTree,
  getState: (token: StateToken) => ValueArray[number]
): ValueArray {
  const calculateNode = (node: ClientSyntaxTree): ValueArray[] => {
    let values = resolveClientChildren(node.children, getState, calculateNode);

    if (node.type === "fetch") {
      // find out what to do here!
      values = [];
    } else if (node.type === "select") {
      // and here
      values = [];
    } else if (node.type === "root") {
      // do nothing
    } else if (node.type === null) {
      // brackets
      values = [spreadImplicitArrays(values)];
    } else if (node.type === "array") {
      values = [[spreadImplicitArrays(values)]];
    } else {
      values = compute(
        node.type as Exclude<
          typeof node.type,
          "select" | "fetch" | "array" | "root" | null
        >,
        values
      );
    }

    return values;
  };

  const value = calculateNode(node);

  return value.reduce((acc, cur) => [...acc, ...cur], []);
}
