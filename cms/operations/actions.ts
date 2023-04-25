import type { FunctionName } from "@storyflow/shared/types";
import type {
  DocumentConfigItem,
  Space,
  DBFolder,
} from "@storyflow/db-core/types";
import type { FunctionData } from "@storyflow/fields-core/types";
import type { TokenStream } from "./types";

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
