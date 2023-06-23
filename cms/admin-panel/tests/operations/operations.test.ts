import {
  QueueEntry,
  TimelineEntry,
  Transaction,
  TransactionEntry,
} from "@storyflow/collab/types";
import { read } from "@storyflow/collab/utils";
import { describe, expect, it } from "vitest";
import { applyFieldTransaction } from "../../src/operations/apply";
import { TokenStream } from "../../src/operations/types";
import { FieldTransactionEntry } from "../../src/operations/actions";

export const createQueueFromTimeline = <
  TE extends TransactionEntry = TransactionEntry
>(
  entries: TimelineEntry[]
): QueueEntry<TE>[] => {
  const queueEntries: QueueEntry<TE>[] = [];

  entries.forEach((el: TimelineEntry, timelineIndex_: number) => {
    const { transactions, ...metadata } = read(el);
    const timelineIndex = null;

    transactions.forEach((transaction, transactionIndex) => {
      queueEntries.push({
        ...metadata,
        timelineIndex,
        transactionIndex,
        transaction: transaction as Transaction<TE>,
        trackers: undefined,
      });
    });
  });

  return queueEntries;
};

it("", () => {
  const operations: TimelineEntry[] = [];

  let prev: TokenStream = [];

  createQueueFromTimeline(operations).forEach(({ transaction }) => {
    transaction.forEach((entry) => {
      if (entry[0] === "000000011fdb000000000000") {
        ({ stream: prev } = applyFieldTransaction(
          { stream: prev, transforms: [] },
          entry as FieldTransactionEntry
        ));
      }
    });
    return prev;
  });

  expect(1).toMatchObject(1);
});
