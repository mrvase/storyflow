import { Transaction, SpliceOperation } from "@storyflow/collab/types";
import { isSpliceOperation } from "@storyflow/collab/utils";
import { FieldId } from "@storyflow/shared/types";
import { FieldTransactionEntry } from "../../operations/actions";
import { tools } from "../../operations/stream-methods";

export const isTextInsert = (
  transaction: Transaction<FieldTransactionEntry>
): transaction is [[FieldId, [[number, number, [string]]]]] => {
  if (!isSingleSpliceTransaction(transaction)) return false;
  const op = transaction[0][1][0];
  return (
    Array.isArray(op[2]) &&
    op[2].length === 1 &&
    typeof op[2][0] === "string" &&
    !op[1]
  );
};

export const isTextDeletion = (
  transaction: Transaction<FieldTransactionEntry>
): transaction is [[FieldId, [[number, number]]]] => {
  if (!isSingleSpliceTransaction(transaction)) return false;
  const op = transaction[0][1][0];
  return Boolean((!op[2] || !op[2].length) && op[1]);
};

export const isSingleSpliceTransaction = (
  value: Transaction<FieldTransactionEntry>
): value is [[FieldId, [SpliceOperation]]] => {
  return (
    value.length === 1 &&
    value[0][1].length === 1 &&
    isSpliceOperation(value[0][1][0])
  );
};

export const isAdjacent = (
  prev: Transaction<FieldTransactionEntry>,
  next: Transaction<FieldTransactionEntry>
): boolean => {
  if (!isSingleSpliceTransaction(prev) || !isSingleSpliceTransaction(next)) {
    return false;
  }

  const prevOp = prev[0][1][0];
  const nextOp = next[0][1][0];

  const prevEndingIndex = prevOp[0] + tools.getLength(prevOp[2] ?? []); // - (prevOp[1] ?? 0);
  const nextStartingIndex = nextOp[0] + (nextOp[1] ?? 0);

  return prevEndingIndex === nextStartingIndex;
};
