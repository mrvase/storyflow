import type {
  SpliceOperation,
  ToggleOperation,
  TransactionEntry,
} from "@storyflow/collab/types";
import { FieldId, FunctionName } from "@storyflow/shared/types";
import { TokenStream } from "./types";
import { GetFunctionData } from "@storyflow/fields-core/types";

export type StreamOperation = SpliceOperation<TokenStream[number]>;

export type FunctionOperation = {
  [Key in FunctionName]: ToggleOperation<Key, GetFunctionData<Key>>;
}[FunctionName];

export type FieldTransactionEntry = TransactionEntry<
  FieldId,
  StreamOperation | FunctionOperation
>;
