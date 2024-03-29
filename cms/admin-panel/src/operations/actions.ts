import type {
  SpliceOperation,
  ToggleOperation,
  TransactionEntry,
} from "@storyflow/collab/types";
import {
  DocumentId,
  FieldId,
  FolderId,
  FunctionName,
} from "@storyflow/shared/types";
import { TokenStream } from "./types";
import { FieldConfig, GetFunctionData } from "@storyflow/cms/types";
import { DocumentConfigItem, Space } from "@storyflow/cms/types";
import { SpaceId } from "@storyflow/cms/types";

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

export type DocumentAddTransactionEntry =
  | TransactionEntry<FolderId, ToggleOperation<"add", DocumentId>>
  | TransactionEntry<FolderId, ToggleOperation<"remove", DocumentId>>;

export type FolderSpliceOperation = SpliceOperation<Space>;
export type FolderPropertyOperation =
  | ToggleOperation<"template", DocumentId>
  | ToggleOperation<"label", string>
  | ToggleOperation<"domains", string[]>;

export type FolderTransactionEntry =
  | TransactionEntry<FolderId, FolderSpliceOperation>
  | TransactionEntry<FolderId, FolderPropertyOperation>;

export type SpaceSpliceOperation = SpliceOperation<FolderId>;
export type SpacePropertyOperation = ToggleOperation<"label", string>;
export type SpaceTransactionEntry =
  | TransactionEntry<`${FolderId}:${SpaceId}`, SpaceSpliceOperation>
  | TransactionEntry<`${FolderId}:${SpaceId}`, SpacePropertyOperation>;
