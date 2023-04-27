import {
  createServerPackage,
  ServerPackage,
  unwrapServerPackage,
} from "@storyflow/state";
import { describe, expect, it } from "vitest";
import { createSpliceTransformer } from "../splice-transform";
import { tools } from "../stream-methods";
import { FieldOperation, SpliceAction, StdOperation } from "../actions";
import { TokenStream } from "../types";

const createTransformer = (initialValue: TokenStream) => {
  const getInitialLength = (target: string) => initialValue.length;
  return createSpliceTransformer<FieldOperation>(
    getInitialLength,
    (target, value) => tools.getLength(value)
  );
};

const createPackage = (
  index: number,
  clientId: string,
  ...actions: SpliceAction<TokenStream[number]>[][]
): ServerPackage<FieldOperation> => {
  return createServerPackage({
    key: "",
    clientId,
    index,
    operations: actions.map((ops) => ["", ops]),
  });
};

const getStringCreator =
  (initialValue: string[]) => (packages: ServerPackage<any>[]) => {
    const newValue = initialValue.map((el) => el.split("")).flat(1);
    packages.forEach((pkg) => {
      const { operations } = unwrapServerPackage(pkg);
      let removed: any[] = [];
      operations.forEach(([, ops]) => {
        ops.forEach((el: SpliceAction<string>) => {
          let insert = [...(el.insert ?? [])];
          if (!el.insert && !el.remove) {
            insert = removed;
          }
          const currentlyRemoved = newValue.splice(
            el.index,
            el.remove ?? 0,
            ...insert.map((el) => el.split("")).flat(1)
          );
          removed.push(...currentlyRemoved);
        });
      });
    });
    return newValue.join("");
  };

describe("transformer", () => {
  it("should not transform packages from different clients that know of each other", () => {
    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"], remove: 0 },
    ]);
    const word2 = createPackage(1, "b", [
      { index: 3, insert: [" med"], remove: 0 },
    ]);
    const word3 = createPackage(2, "c", [
      { index: 7, insert: [" dig"], remove: 0 },
    ]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word2, word3])).toBe("hej med dig");
    const result = transform([word1, word2, word3]);
    expect(result).toMatchObject([word1, word2, word3]);
    expect(createString(result)).toBe("hej med dig");
  });
  it("does transform when external package is unknowingly inserted in between another client's packages", () => {
    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"], remove: 0 },
    ]);
    const word2 = createPackage(1, "a", [
      { index: 3, insert: [" med"], remove: 0 },
      { index: 7, insert: [" dig"], remove: 0 },
    ]);

    const word4 = createPackage(1, "b", [
      { index: 3, insert: [" eller"], remove: 0 },
      { index: 9, insert: [" goddag"], remove: 0 },
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
    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"], remove: 0 },
    ]);
    const word2 = createPackage(1, "a", [
      { index: 3, insert: [" med"], remove: 0 },
      { index: 7, insert: [" dig"], remove: 0 },
    ]);

    const word4 = createPackage(1, "b", [
      { index: 3, insert: [" eller"], remove: 0 },
      { index: 9, insert: [" goddag"], remove: 0 },
    ]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString(transform([word1, word2, word4]))).toBe(
      "hej med dig eller goddag"
    );
  });

  it("removes word correctly", () => {
    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"], remove: 0 },
      { index: 3, insert: [" med"], remove: 0 },
      { index: 7, insert: [" dig"], remove: 0 },
    ]);

    const word2 = createPackage(1, "a", [
      { index: 3, insert: [" også"], remove: 0 },
    ]);

    const word3 = createPackage(1, "b", [{ index: 3, insert: [], remove: 4 }]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word3])).toBe("hej dig");
    // expect(createString(transform([word1, word2, word3]))).toBe("hej også dig");
  });

  it("removes a split word correctly", () => {
    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"], remove: 0 },
      { index: 3, insert: [" med"], remove: 0 },
      { index: 7, insert: [" dig"], remove: 0 },
    ]);
    const word2 = createPackage(1, "a", [{ index: 4, insert: [], remove: 3 }]);

    const word3 = createPackage(1, "b", [
      { index: 5, insert: ["bla"], remove: 0 },
    ]);

    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    expect(createString([word1, word3])).toBe("hej mblaed dig");

    expect(
      unwrapServerPackage(word2)
        .operations.map(([, ops]) => ops)
        .flat(1)
    ).toHaveLength(1);

    transform([word1, word3, word2]);

    // now the package is split into two
    expect(
      unwrapServerPackage(word2)
        .operations.map(([, ops]) => ops)
        .flat(1)
    ).toHaveLength(2);

    expect(createString([word1, word3, word2])).toBe("hej bla dig");
  });

  it("keeps reference on move - deletion", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"] },
      { index: 3, insert: [" med"] },
      { index: 7, insert: [" dig"] },
    ]);
    const word2 = createPackage(1, "a", [
      { index: 3, remove: 4 },
      { index: 7, insert: [" med"], remove: 3 },
    ]);

    const word3 = createPackage(1, "b", [{ index: 4, remove: 1 }]);

    expect(createString([word1, word2])).toBe("hej dig med");
    expect(createString([word1, word3])).toBe("hej ed dig");
    expect(createString(transform([word1, word2, word3]))).toBe("hej dig med");

    const newWord2 = createPackage(1, "a", [
      { index: 3, remove: 4 },
      { index: 7 },
    ]);
    const newWord3 = createPackage(1, "b", [{ index: 4, remove: 1 }]);

    expect(createString([word1, newWord2])).toBe("hej dig med");
    expect(createString(transform([word1, newWord2, newWord3]))).toBe(
      "hej dig ed"
    );
  });

  it("keeps reference on move - insert", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"] },
      { index: 3, insert: [" med"] },
      { index: 7, insert: [" dig"] },
    ]);
    const word2 = createPackage(1, "a", [
      { index: 3, remove: 4 },
      { index: 7 },
    ]);
    const word3 = createPackage(1, "b", [
      { index: 5, insert: ["a"], remove: 1 },
    ]);

    expect(createString(transform([word1, word2, word3]))).toBe("hej dig mad");
  });

  it("inserts correctly with deletion overlap", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["hej"] },
      { index: 3, insert: [" med"] },
      { index: 7, insert: [" dig"] },
    ]);
    const word2 = createPackage(1, "a", [{ index: 3, remove: 4 }]);
    const word3 = createPackage(1, "b", [
      { index: 5, insert: ["a"], remove: 1 },
    ]);

    expect(createString(transform([word1, word2, word3]))).toBe("heja dig");
  });

  it("handles the case where a queue is partly inserted and the 'rest queue' is both aware of the shared queue and the part of the queue that was just inserted", () => {
    const initialValue = [""];
    const transform = createTransformer(initialValue);
    const createString = getStringCreator(initialValue);

    const word1 = createPackage(0, "a", [
      { index: 0, insert: ["a"] },
      { index: 0, remove: 1 },
      { index: 0, insert: ["a"] },
    ]);
    const word2 = createPackage(0, "a", [{ index: 0, remove: 1 }]);

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

    const word3 = createPackage(
      0,
      "a",
      [{ index: 0, insert: ["a"] }],
      [{ index: 0, remove: 1 }]
    );
    const word4 = createPackage(0, "b", [{ index: 0, insert: ["b"] }]);
    const word5 = createPackage(
      0,
      "a",
      [{ index: 0, insert: ["a"] }],
      [{ index: 0, remove: 1 }]
    );

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

    const word3 = createPackage(0, "a", [
      { index: 0, insert: ["jeg heder Martin"] },
    ]);
    const word4 = createPackage(1, "b", [{ index: 6, insert: ["d"] }]);
    const word5 = createPackage(
      1,
      "a",
      [{ index: 3, remove: 6 }],
      [{ index: 11 }]
    );

    expect(createString(transform([word3, word4, word5]))).toBe(
      "jegd Martin heder"
    );
  });
});
