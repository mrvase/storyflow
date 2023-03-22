import {
  DocumentConfigItem,
  FieldType,
  Space,
  DBFolder,
  TokenStream,
} from "@storyflow/backend/types";

type GetKeyFromValue<Record extends { [key: string]: any }, Value> = keyof {
  [K in keyof Record as Value extends Record[K] ? K : never]: any;
};

const operations = {
  computation: "1",
  /*
  fetcher: "2",
  "filter-list": "3",
  filter: "4",
  */
  property: "5",
  "document-config": "6",
  "add-folder": "7",
  "delete-folder": "8",
  "folder-spaces": "9",
  "space-items": "10",
} as const;

type OperationRecord = {
  computation: ComputationOp;
  /*
  fetcher: FetcherOp;
  "filter-list": FilterListOp;
  filter: FilterOp;
  */
  property: PropertyOp;
  "document-config": DocumentConfigOp;
  "add-folder": AddFolderOp;
  "delete-folder": DeleteFolderOp;
  "folder-spaces": FolderSpacesOp;
  "space-items": SpaceItemsOp;
};

const fields = {
  default: "1",
  url: "3",
  slug: "4",
  fetch: "5",
} satisfies Record<FieldType, `${number}`>;

/**
 *
 */

const splitter = ":" as const;

export type Target<
  F extends keyof typeof fields = keyof typeof fields,
  O extends keyof typeof operations = keyof typeof operations,
  L extends string = string
> = `${(typeof fields)[F] | "0"}${typeof splitter}${
  | (typeof operations)[O]
  | "0"}${typeof splitter}${L}`;

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
export type ComputationOp = DocumentOp<Splice<TokenStream[number]>>;

export type AddFolderOp = DocumentOp<DBFolder>;
export type DeleteFolderOp = DocumentOp<string>;

export type FolderSpacesOp = DocumentOp<Splice<Space>>;
export type FolderOp = PropertyOp | FolderSpacesOp;

export type SpaceItemsOp = DocumentOp<Splice<string>>;
export type SpaceOp = PropertyOp | SpaceItemsOp;

/*
export type FetcherOp = DocumentOp<Toggle<"folder", string>>;
export type FilterListOp = DocumentOp<Splice<Filter>>;
export type FilterOp = DocumentOp<Toggle<"template" | "operation", string>>;
*/

export type PropertyOp = DocumentOp<Toggle<string, any>>;
export type DocumentConfigOp = DocumentOp<Splice<DocumentConfigItem>>;

export const targetTools = {
  stringify<
    F extends keyof typeof fields,
    O extends keyof typeof operations,
    L extends string
  >({
    field,
    operation,
    location,
  }: {
    field?: F;
    operation?: O;
    location: L;
  }): Target<F, O, L> {
    return `${field ? fields[field] : "0"}${splitter}${
      operation ? operations[operation] : "0"
    }${splitter}${location}`;
  },
  parse(string: string): {
    field: keyof typeof fields | undefined;
    operation: keyof typeof operations | undefined;
    location: string;
  } {
    const [field, operation, location] = string.split(splitter);
    return {
      field: Object.entries(fields).find(
        ([, value]) => value === field
      )?.[0] as keyof typeof fields | undefined,
      operation: Object.entries(operations).find(
        ([, value]) => value === operation
      )?.[0] as keyof typeof operations | undefined,
      location,
    };
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
    return targetTools.parse(operation.target).operation === input;
  },
};
