import type {
  SpliceOperation,
  ToggleOperation,
  TransactionEntry,
} from "@storyflow/collab/types";
import { FieldId, FunctionName } from "@storyflow/shared/types";
import { TokenStream } from "./types";
import { FieldConfig, GetFunctionData } from "@storyflow/fields-core/types";
import { DocumentConfigItem } from "@storyflow/db-core/types";
import { createTransaction } from "@storyflow/collab/utils";

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
