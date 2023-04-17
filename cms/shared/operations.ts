import {
  DocumentConfigItem,
  Space,
  DBFolder,
  TokenStream,
  FunctionName,
  GetFunctionData,
  FunctionData,
} from "@storyflow/backend/types";

type GetKeyFromValue<Record extends { [key: string]: any }, Value> = keyof {
  [K in keyof Record as Value extends Record[K] ? K : never]: any;
};

/*
const operations = {
  computation: "1",
  transform: "2",
  property: "5",
  "document-config": "6",
  "add-folder": "7",
  "delete-folder": "8",
  "folder-spaces": "9",
  "space-items": "10",
} as const;

type OperationRecord = {
  computation: ComputationOp;
  transform: TransformOp;
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
} satisfies Record<FieldType, `${number}`>;

const splitter = ":" as const;

export type Target<
  F extends keyof typeof fields = keyof typeof fields,
  O extends keyof typeof operations = keyof typeof operations,
  L extends string = string
> = `${(typeof fields)[F] | "0"}${typeof splitter}${
  | (typeof operations)[O]
  | "0"}${typeof splitter}${L}`;
*/

/**
 *
 */

export type StdOperation<
  T =
    | SpliceAction<any>
    | ToggleAction<string, any>
    | AddFolderAction
    | DeleteFolderAction
> = [target: string, ops: T[], ...mode: string[]];

export type InferAction<T extends StdOperation<any>> = T extends StdOperation<
  infer Action
>
  ? Action
  : never;

export type SpliceAction<T> = {
  index: number;
  remove?: number;
  insert?: T[];
};

export type ToggleAction<Name = string, Value = string> = {
  name: Name;
  value: Value;
};

export const isSpliceAction = (
  action: unknown
): action is SpliceAction<any> => {
  return typeof action === "object" && action !== null && "index" in action;
};

export const isToggleAction = (
  action: unknown
): action is ToggleAction<any, any> => {
  return typeof action === "object" && action !== null && "name" in action;
};

/**
 * OPERATION TYPES
 */
export type PropertyAction = ToggleAction<string, any>;

export type StreamAction = SpliceAction<TokenStream[number]>;
export type TransformAction<T extends FunctionName = FunctionName> =
  ToggleAction<T, FunctionData | null>;
export type FieldOperation = StdOperation<StreamAction | TransformAction>;

export type AddFolderAction = { add: DBFolder };
export type DeleteFolderAction = { remove: string };
export type FolderListOperation = StdOperation<
  AddFolderAction | DeleteFolderAction
>;

export type FolderSpacesAction = SpliceAction<Space>;
export type FolderOperation = StdOperation<PropertyAction | FolderSpacesAction>;

export type SpaceItemsAction = SpliceAction<string>;
export type SpaceOperation = StdOperation<PropertyAction | SpaceItemsAction>;

export type DocumentConfigAction = SpliceAction<DocumentConfigItem>;

export type DocumentOperation = StdOperation<
  DocumentConfigAction | PropertyAction
>;

/*
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
*/
