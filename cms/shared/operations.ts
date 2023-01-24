import {
  EditorComputation,
  DocumentConfigItem,
  Filter,
  FieldType,
} from "@storyflow/backend/types";

type GetKeyFromValue<Record extends { [key: string]: any }, Value> = keyof {
  [K in keyof Record as Value extends Record[K] ? K : never]: any;
};

export const operations = {
  any: "0",
  computation: "1",
  fetcher: "2",
  "filter-list": "3",
  filter: "4",
  property: "5",
  "document-config": "6",
} as const;

export type OperationType = Exclude<keyof typeof operations, "any">;

export type OperationRecord = {
  computation: ComputationOp;
  fetcher: FetcherOp;
  "filter-list": FilterListOp;
  filter: FilterOp;
  property: PropertyOp;
  "document-config": DocumentConfigOp;
};

export const fields = {
  any: "0",
  default: "1",
  url: "3",
  slug: "4",
} satisfies Record<FieldType | "any", `${number}`>;

export type FieldOperation = {
  default: ComputationOp;
  url: ComputationOp;
  slug: ComputationOp;
};

/**
 *
 */

const splitter = ":" as const;

export type Target<
  F extends keyof typeof fields = keyof typeof fields,
  O extends keyof typeof operations = keyof typeof operations,
  L extends string = string
> = `${(typeof fields)[F]}${typeof splitter}${(typeof operations)[O]}${typeof splitter}${L}`;

export interface DocumentOp<T> {
  target: Target<keyof typeof fields, keyof typeof operations, string>;
  mode?: string;
  ops: T[];
}

export type AnyOp = DocumentOp<any>;

export type InferAction<T extends DocumentOp<any>> = T extends DocumentOp<
  infer Action
>
  ? Action
  : never;

export type Splice<T> = {
  index: number;
  remove?: number;
  insert?: T[];
};

export type Toggle<Name = string, T = string> = {
  name: Name;
  value: T;
};

/**
 * OPERATION TYPES
 */
export type ComputationOp = DocumentOp<Splice<EditorComputation[number]>>;

export type FetcherOp = DocumentOp<Toggle<"folder", string>>;
export type FilterListOp = DocumentOp<Splice<Filter>>;
export type FilterOp = DocumentOp<Toggle<"template" | "operation", string>>;

export type PropertyOp = DocumentOp<Toggle<string, any>>;
export type DocumentConfigOp = DocumentOp<Splice<DocumentConfigItem>>;

export const targetTools = {
  stringify<
    F extends keyof typeof fields,
    O extends keyof typeof operations,
    L extends string
  >({
    field = "any" as F,
    operation = "any" as O,
    location,
  }: {
    field?: F;
    operation?: O;
    location: L;
  }): Target<F, O, L> {
    return `${fields[field]}${splitter}${operations[operation]}${splitter}${location}`;
  },
  parse<L extends string>(
    string: L
  ): L extends `${infer F}${typeof splitter}${infer O}${typeof splitter}${infer L}`
    ? {
        field: GetKeyFromValue<typeof fields, F>;
        input: GetKeyFromValue<typeof operations, O>;
        location: L;
      }
    : never {
    const [field, operation, location] = string.split(splitter);
    return {
      field: Object.entries(fields).find(([, value]) => value === field)![0],
      input: Object.entries(operations).find(
        ([, value]) => value === operation
      )![0],
      location,
    } as any;
  },
  getLocation<
    F extends keyof typeof fields,
    O extends keyof typeof operations,
    L extends string,
    T extends Target<F, O, L>
  >(t: T): L {
    return targetTools.parse(t).location as L;
  },
  targetsField<T extends FieldType>(
    operation: OperationRecord[keyof OperationRecord],
    field: T
  ): operation is ComputationOp {
    return targetTools.parse(operation.target).field === field;
  },
  isOperation<T extends keyof OperationRecord>(
    operation: OperationRecord[keyof OperationRecord],
    input: T
  ): operation is OperationRecord[T] {
    return targetTools.parse(operation.target).input === input;
  },
};
