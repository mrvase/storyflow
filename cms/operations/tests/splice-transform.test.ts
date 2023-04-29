import { describe, expect, it } from "vitest";
import { createSpliceTransformer } from "../splice-transform";
import { tools } from "../stream-methods";
import { FieldOperation, SpliceAction, StdOperation } from "../actions";
import { TokenStream } from "../types";
import { SpliceOperation, TimelineEntry } from "@storyflow/collab/types";

const createTransformer = (initialValue: TokenStream) => {
  const getInitialLength = (target: string) => initialValue.length;
  return createSpliceTransformer(getInitialLength, (target, value) =>
    tools.getLength(value)
  );
};

const createTimelineEntry = (
  index: number,
  clientId: string,
  ...transactions: SpliceOperation<TokenStream[number]>[][]
): TimelineEntry => {
  return [
    index,
    clientId,
    "",
    ...transactions.map((operations) => {
      return [["", operations] as [string, typeof operations]];
    }),
  ];
};

const getStringCreator =
  (initialValue: string[]) => (packages: TimelineEntry[]) => {
    const newValue = initialValue.map((el) => el.split("")).flat(1);
    packages.forEach((pkg) => {
      const [, , , ...transactions] = pkg;
      let removed: any[] = [];
      transactions.forEach((transaction) => {
        transaction.forEach(([, ops]) => {
          (ops as SpliceOperation<string>[]).forEach((el) => {
            let [index, remove, insert = []] = el;
            if (!insert.length && !remove) {
              insert = removed;
            }
            const currentlyRemoved = newValue.splice(
              index,
              remove ?? 0,
              ...insert.map((el) => el.split("")).flat(1)
            );
            removed.push(...currentlyRemoved);
          });
        });
      });
    });
    return newValue.join("");
  };

describe("transformer", () => {
  it("should not transform packages from different clients that know of each other", () => {
    const word1 = createTimelineEntry(0, "a", [[0, 0, ["hej"]]]);
    const word2 = createTimelineEntry(1, "b", [[3, 0, [" med"]]]);
    const word3 = createTimelineEntry(2, "c", [[7, 0, [" dig"]]]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word2, word3])).toBe("hej med dig");
    const result = transform([word1, word2, word3]);
    expect(result).toMatchObject([word1, word2, word3]);
    expect(createString(result)).toBe("hej med dig");
  });
  it("does transform when external package is unknowingly inserted in between another client's packages", () => {
    const word1 = createTimelineEntry(0, "a", [[0, 0, ["hej"]]]);
    const word2 = createTimelineEntry(1, "a", [
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);

    const word4 = createTimelineEntry(1, "b", [
      [3, 0, [" eller"]],
      [9, 0, [" goddag"]],
    ]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word4])).toBe("hej eller goddag");

    expect(createString(transform([word1, word4, word2]))).toBe(
      "hej eller goddag med dig"
    );

    // already transformed mutably!
    expect(createString(transform([word1, word2, word4]))).not.toBe(
      "hej med dig eller goddag"
    );
  });
  it("does transform correctly with the above reversed", () => {
    const word1 = createTimelineEntry(0, "a", [[0, 0, ["hej"]]]);
    const word2 = createTimelineEntry(1, "a", [
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);

    const word4 = createTimelineEntry(1, "b", [
      [3, 0, [" eller"]],
      [9, 0, [" goddag"]],
    ]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString(transform([word1, word2, word4]))).toBe(
      "hej med dig eller goddag"
    );
  });

  it("removes word correctly", () => {
    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["hej"]],
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);

    const word2 = createTimelineEntry(1, "a", [[3, 0, [" også"]]]);

    const word3 = createTimelineEntry(1, "b", [[3, 4]]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word3])).toBe("hej dig");
    // expect(createString(transform([word1, word2, word3]))).toBe("hej også dig");
  });

  it("removes a split word correctly", () => {
    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["hej"]],
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);
    const word2 = createTimelineEntry(1, "a", [[4, 3]]);

    const word3 = createTimelineEntry(1, "b", [[5, 0, ["bla"]]]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word3])).toBe("hej mblaed dig");

    expect(word2[3][0][1]).toHaveLength(1);

    transform([word1, word3, word2]);

    // now the package is split into two
    expect(word2[3][0][1]).toHaveLength(2);

    expect(createString([word1, word3, word2])).toBe("hej bla dig");
  });

  it("keeps reference on move - deletion", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["hej"]],
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);
    const word2 = createTimelineEntry(1, "a", [
      [3, 4],
      [7, 3, [" med"]],
    ]);

    const word3 = createTimelineEntry(1, "b", [[4, 1]]);

    expect(createString([word1, word2])).toBe("hej dig med");
    expect(createString([word1, word3])).toBe("hej ed dig");
    expect(createString(transform([word1, word2, word3]))).toBe("hej dig med");

    const newWord2 = createTimelineEntry(1, "a", [[3, 4], [7]]);
    const newWord3 = createTimelineEntry(1, "b", [[4, 1]]);

    expect(createString([word1, newWord2])).toBe("hej dig med");
    expect(createString(transform([word1, newWord2, newWord3]))).toBe(
      "hej dig ed"
    );
  });

  it("keeps reference on move - insert", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["hej"]],
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);
    const word2 = createTimelineEntry(1, "a", [[3, 4], [7]]);
    const word3 = createTimelineEntry(1, "b", [[5, 1, ["a"]]]);

    expect(createString(transform([word1, word2, word3]))).toBe("hej dig mad");
  });

  it("inserts correctly with deletion overlap", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["hej"]],
      [3, 0, [" med"]],
      [7, 0, [" dig"]],
    ]);
    const word2 = createTimelineEntry(1, "a", [[3, 4]]);
    const word3 = createTimelineEntry(1, "b", [[5, 1, ["a"]]]);

    expect(createString(transform([word1, word2, word3]))).toBe("heja dig");
  });

  it("handles the case where a queue is partly inserted and the 'rest queue' is both aware of the shared queue and the part of the queue that was just inserted", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createTimelineEntry(0, "a", [
      [0, 0, ["a"]],
      [0, 1],
      [0, 0, ["a"]],
    ]);
    const word2 = createTimelineEntry(0, "a", [[0, 1]]);

    expect(createString(transform([word1, word2]))).toBe("");
  });

  it("part 2", () => {
    /**
     * The below case will try to transform the operations in word5.
     * it is important that it therefore recognizes that the character
     * removed in the second operation in word5 is the character
     * inserted in the first operation in word5
     */
    const initialValue: string[] = [];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word3 = createTimelineEntry(0, "a", [[0, 0, ["a"]]], [[0, 1]]);
    const word4 = createTimelineEntry(0, "b", [[0, 0, ["b"]]]);
    const word5 = createTimelineEntry(0, "a", [[0, 0, ["a"]]], [[0, 1]]);

    expect(createString(transform([word3, word4, word5]))).toBe("b");
  });

  it("should insert word like it was removed even though it has been split", () => {
    /*
    This might not be the intended behavior. But I do not really drag things when it comes to text.
    Let us say it is components instead. If I drag two components, and another component is put in between,
    should that component stay with the others or be left behind?
    */
    const initialValue: string[] = [];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word3 = createTimelineEntry(0, "a", [[0, 0, ["jeg heder Martin"]]]);
    const word4 = createTimelineEntry(1, "b", [[6, 0, ["d"]]]);
    const word5 = createTimelineEntry(1, "a", [[3, 6]], [[11]]);

    expect(createString(transform([word3, word4, word5]))).toBe(
      "jegd Martin heder"
    );
  });
});
