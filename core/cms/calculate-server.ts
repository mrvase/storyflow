import { computeFieldId, createFieldId, getDocumentId } from "./ids";
import { tokens } from "./tokens";
import {
  NestedFolder,
  ValueArray,
  ContextToken,
  DocumentId,
  FieldId,
  NestedDocument,
  StateToken,
  ClientSyntaxTree,
  Sorting,
  NestedDocumentId,
} from "@storyflow/shared/types";
import { spreadImplicitArrays, compute } from "@storyflow/shared/calculate";
import { SyntaxTree, SyntaxTreeRecord, GetFunctionData } from "./types";
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

export type Importer<TType extends string, TValue> = {
  type: TType;
  value: TValue;
};

export type FolderFetch = {
  folder: NestedFolder;
  limit: number;
  sort?: Sorting[];
  offset?: number;
};

type AnyImporter =
  | Importer<"field", FieldId>
  | Importer<"fetch", FolderFetch>
  | Importer<"context", ContextToken>
  | Importer<"nested", NestedDocumentId>;

export type StateGetter = {
  (importer: AnyImporter, options: { tree: true; external?: boolean }):
    | SyntaxTree
    | undefined;
  (importer: AnyImporter, options: { tree: boolean; external?: boolean }):
    | SyntaxTree
    | ClientSyntaxTree
    | ValueArray
    | undefined;
  (importer: AnyImporter, options: { tree?: undefined; external?: boolean }):
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
              return getState(
                { type: "field", value: fieldId },
                { external: false }
              );
            })
          : []; // not the case when resulting from select

      const hasArgs = args.some(
        (el) => el !== undefined && (!Array.isArray(el) || el.length > 0)
      );

      const state = getState(
        { type: "field", value: child.field },
        {
          tree: hasArgs,
          external: true,
        }
      );

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
      const state = getState(
        { type: "context", value: child },
        { external: false }
      );
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
  options: {
    ignoreClientState: true;
    createActions?: boolean;
    offset?: number;
  }
): ValueArray;
export function calculate(
  node: SyntaxTree,
  getState: StateGetter,
  options?: {
    ignoreClientState?: false;
    createActions?: boolean;
    offset?: number;
  }
): ValueArray | ClientSyntaxTree;
export function calculate(
  node: SyntaxTree,
  getState: StateGetter,
  options?: {
    ignoreClientState?: boolean;
    createActions?: boolean;
    offset?: number;
  }
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

    if (node.type === "insert" && options?.createActions) {
      values = [
        spreadImplicitArrays(values).reduce((acc: NestedDocument[], el) => {
          if (tokens.isNestedFolder(el)) {
            const state = getState(
              {
                type: "nested",
                value: el.id,
              },
              {
                external: true,
              }
            );
            if (state) {
              acc.push(
                ...(state as NestedDocument[]).map(
                  (values) =>
                    ({
                      values,
                      action: "insert",
                      folder: el.folder,
                    } as any)
                )
              );
            }
          }
          return acc;
        }, []),
      ];
    } else if (node.type === "fetch") {
      const [limit, ...sort] = node.data as GetFunctionData<"fetch">;

      let docs = spreadImplicitArrays(values).reduce(
        (acc: NestedDocument[], el) => {
          if (tokens.isNestedFolder(el)) {
            const state = getState(
              {
                type: "fetch",
                value: {
                  folder: el,
                  limit,
                  ...(options?.offset && { offset: options.offset }),
                  ...(sort.length && { sort }),
                },
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
              const state = getState(
                { type: "field", value: computeFieldId(el.id, select) },
                {
                  external: true,
                }
              );

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

export function calculateField(
  tree: SyntaxTree,
  getRecord: (id: DocumentId) => SyntaxTreeRecord | undefined
) {
  const getter: StateGetter = (importer, { external, tree }): any => {
    if (importer.type !== "field") {
      return [];
    }
    const id = importer.value;

    const importedDocumentId = getDocumentId<DocumentId>(id);

    const externalRecord = getRecord(importedDocumentId);
    const value = externalRecord?.[id];

    if (!value) return;

    if (tree) return value;
    return calculate(value, getter, { ignoreClientState: true });
  };
  const result = calculate(tree, getter, { ignoreClientState: true });
  if (!Array.isArray(result)) {
    throw new Error(
      "It should not be possible to have client state in root field"
    );
  }
  return result;
}

export function calculateRootFieldFromRecord(
  fieldId: FieldId,
  record: SyntaxTreeRecord
) {
  const getter: StateGetter = (importer, { external, tree }): any => {
    if (importer.type !== "field") {
      return [];
    }
    const id = importer.value;

    const value: SyntaxTree | undefined = record[id];

    if (!value) return;

    if (tree) return value;
    return calculate(value, getter, { ignoreClientState: true });
  };

  const tree = record[fieldId];

  if (!tree) return [];

  const result = calculate(tree, getter, { ignoreClientState: true });
  if (!Array.isArray(result)) {
    throw new Error(
      "It should not be possible to have client state in root field"
    );
  }
  return result;
}
