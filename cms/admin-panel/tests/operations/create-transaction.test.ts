import {
  SpliceOperation,
  ToggleOperation,
  TransactionEntry,
} from "@storyflow/collab/types";
import { createTransaction } from "@storyflow/collab/utils";
import { expect, it } from "vitest";

it("works", () => {
  expect(
    createTransaction<
      TransactionEntry<"tester", ToggleOperation<string, any>>,
      string
    >((t) =>
      t.target("tester").toggle({
        name: "test1",
        value: "test2",
      })
    )
  ).toMatchObject([["tester", [["test1", "test2"]]]]);
});

it("works", () => {
  expect(
    createTransaction<TransactionEntry<"tester", SpliceOperation<any>>, string>(
      (t) =>
        t.target("tester").splice(
          {
            index: 0,
            remove: 1,
          },
          {
            index: 5,
            insert: ["test"],
          },
          {
            index: 3,
          }
        )
    )
  ).toMatchObject([["tester", [[0, 1], [5, 0, ["test"]], [3]]]]);
});
