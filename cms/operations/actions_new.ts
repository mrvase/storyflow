import type {
  SpliceOperation,
  ToggleOperation,
  TransactionEntry,
} from "@storyflow/collab/types";
import { DocumentId, FieldId, FunctionName } from "@storyflow/shared/types";
import { TokenStream } from "./types";
import { FieldConfig, GetFunctionData } from "@storyflow/fields-core/types";
import { DBFolder, DocumentConfigItem, Space } from "@storyflow/db-core/types";
import { SpaceId } from "@storyflow/db-core/types";

export type StreamOperation = SpliceOperation<TokenStream[number]>;

export type TransformOperation = {
  [Key in FunctionName]: ToggleOperation<Key, GetFunctionData<Key> | null>;
}[FunctionName];

export type FieldTransactionEntry =
  | TransactionEntry<FieldId, StreamOperation>
  | TransactionEntry<FieldId, TransformOperation>;

export type DocumentSpliceOperation = SpliceOperation<DocumentConfigItem>;

export type DocumentPropertyOperation = Exclude<
  {
    [Key in keyof FieldConfig]: ToggleOperation<Key, FieldConfig[Key]>;
  }[keyof FieldConfig],
  undefined
>;

export type DocumentTransactionEntry =
  | TransactionEntry<"", DocumentSpliceOperation>
  | TransactionEntry<FieldId, DocumentPropertyOperation>;

export type AddFolderOperation = ["add", DBFolder];
export type DeleteFolderOpertation = ["remove", string];
export type FolderListTransactionEntry =
  | TransactionEntry<"", AddFolderOperation>
  | TransactionEntry<"", DeleteFolderOpertation>;

export type FolderSpacesOperation = SpliceOperation<Space>;
export type FolderPropertyOperation =
  | ToggleOperation<"template", DocumentId>
  | ToggleOperation<"label", string>
  | ToggleOperation<"domains", string[]>;
export type FolderTransactionEntry =
  | TransactionEntry<"", FolderSpacesOperation>
  | TransactionEntry<"", FolderPropertyOperation>;

export type SpaceItemsOperation = SpliceOperation<string>;
export type SpacePropertyOperation = ToggleOperation<"label", string>;
export type SpaceTransactionEntry =
  | TransactionEntry<SpaceId, SpaceItemsOperation>
  | TransactionEntry<SpaceId, SpacePropertyOperation>;
