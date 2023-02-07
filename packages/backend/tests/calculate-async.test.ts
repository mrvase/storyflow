import { describe, expect, it } from "vitest";
import { Computation, FieldId, Value } from "../types";
import { calculateAsync as calculateAsync_ } from "./calculate-async";

type ComputationBlock = { id: string; value: Computation };

const calculateAsync = (
  comp: Computation,
  imports: ComputationBlock[] = []
) => {
  const getter = (id: string, returnFunction: boolean = false) => {
    const block = imports.find((el) => el.id == id);
    if (!block) return;
    return new Promise<Value[]>((res) => {
      const result = calculateAsync_(id, block.value, getter, {
        returnFunction,
      });
      setTimeout(() => {
        res(result);
      }, 20);
    });
  };
  return calculateAsync_("root", comp, getter);
};

const calculate = (comp: Computation, imports: ComputationBlock[] = []) => {
  const getter = (id: string, returnFunction: boolean = false) => {
    const block = imports.find((el) => el.id == id);
    if (!block) return;
    return {
      then(callback: any) {
        return callback(
          calculateAsync_(id, block.value, getter, {
            returnFunction,
          })
        );
      },
    };
  };
  return calculateAsync_("root", comp, getter);
};

describe("calculator - simple arithmetics", () => {
  it("multiplies", async () => {
    const computation: Computation = [["("], 2, 5, [")", "*"]];
    const result: Value[] = [2 * 5];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("adds", async () => {
    const computation: Computation = [["("], 2, 5, [")", "+"]];
    const result: Value[] = [2 + 5];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("divides", async () => {
    const computation: Computation = [["("], 2, 5, [")", "/"]];
    const result: Value[] = [2 / 5];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("subtracts", async () => {
    const computation: Computation = [["("], 2, 5, [")", "-"]];
    const result: Value[] = [2 - 5];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
});

describe("calculator - complex arithmetics", () => {
  it("multiplies many numbers", async () => {
    const computation: Computation = [["("], 2, 5, 3, 4, [")", "*"]];
    const result: Value[] = [2 * 5 * 3 * 4];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("handles nested operations", async () => {
    const computation: Computation = [
      ["("],
      ["("],
      5,
      3,
      [")", "+"],
      2,
      [")", "*"],
    ];
    const result: Value[] = [(5 + 3) * 2];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
});

describe("calculator - imports", () => {
  it("operates on single import", async () => {
    const computation: Computation = [
      ["("],
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
      [")", "*"],
    ];
    const result: Value[] = [2 * 5];
    const imports: ComputationBlock[] = [{ id: "a", value: [5] }];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
  it("operates on nested imports", async () => {
    const computation: Computation = [
      ["("],
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
      [")", "*"],
    ];
    const result: Value[] = [2 * (5 - 3 - 1)];

    const imports: ComputationBlock[] = [
      {
        id: "a",
        value: [
          ["("],
          5,
          { id: "imp", fref: "b" as FieldId, args: {} },
          1,
          [")", "-"],
        ],
      },
      { id: "b", value: [3] },
    ];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
});

describe("calculator - functions", () => {
  it("replaces parameter with default value when no args are provided", async () => {
    const computation: Computation = [
      ["("],
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
      [")", "*"],
    ];
    const result: Value[] = [2 * (6 / 2)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [["("], 6, [0, 2], [")", "/"]] },
    ];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
  it("replaces parameter with args", async () => {
    const computation: Computation = [
      ["("],
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
      [")", "*"],
    ];
    const result: Value[] = [2 * (6 / 3)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [["("], 6, [0, 2], [")", "/"]] },
      { id: "root.imp/0", value: [3] },
    ];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
});

describe("calculator - arrays", () => {
  it("ignores parentheses", async () => {
    const computation: Computation = [["("], 1, 2, [")"]];
    const result: Value[] = [1, 2];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("ignores parentheses", async () => {
    const computation: Computation = [1, ["("], 2, 3, [")"], 4];
    const result: Value[] = [1, 2, 3, 4];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
});

describe("calculator - arrays", () => {
  it("handles single array", async () => {
    const computation: Computation = [["["], 2, 3, ["]"]];
    const result: Value[] = [[2, 3]];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("handles array among primitive values", async () => {
    const computation: Computation = [1, ["["], 2, 3, ["]"], 4];
    const result: Value[] = [1, [2, 3], 4];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
  it("handles nested arrays", async () => {
    const computation: Computation = [
      1,
      ["["],
      2,
      ["["],
      3,
      ["["],
      4,
      5,
      ["]"],
      ["]"],
      6,
      ["]"],
    ];
    const result: Value[] = [1, [2, [3, [4, 5]], 6]];

    expect(calculate(computation)).toMatchObject(result);
    expect(await calculateAsync(computation)).toMatchObject(result);
  });
});

describe("calculator - imports and arrays", () => {
  it("handles import of array into array", async () => {
    const computation: Computation = [
      1,
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
    ];
    const imports: ComputationBlock[] = [{ id: "a", value: [3, 4, 5] }];
    const result: Value[] = [1, 2, 3, 4, 5];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
  it("handles import of nested array into array", async () => {
    const computation: Computation = [
      1,
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
    ];
    const imports: ComputationBlock[] = [
      { id: "a", value: [3, ["["], 4, 5, ["]"]] },
    ];
    const result: Value[] = [1, 2, 3, [4, 5]];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
  it("handles import of array element", async () => {
    const computation: Computation = [
      ["["],
      1,
      2,
      ["]"],
      3,
      { id: "imp", fref: "a" as FieldId, args: {} },
    ];
    const imports: ComputationBlock[] = [
      { id: "a", value: [["["], 4, 5, ["]"], 6] },
    ];
    const result: Value[] = [[1, 2], 3, [4, 5], 6];

    expect(calculate(computation, imports)).toMatchObject(result);
    expect(await calculateAsync(computation, imports)).toMatchObject(result);
  });
  it("can multiply array with array", () => {
    expect(calculate([["("], ["["], 2, 3, ["]"], 3, [")", "*"]])).toMatchObject(
      [6, 9]
    );
    expect(
      calculate([["("], ["["], 2, 3, ["]"], 3, 2, [")", "*"]])
    ).toMatchObject([12, 18]);
    expect(
      calculate([["("], ["["], 1, 2, ["]"], ["["], 3, 4, ["]"], [")", "*"]])
    ).toMatchObject([3, 6, 4, 8]);
  });
  it("concatenates string", () => {
    expect(calculate([["("], "a", "b", [")", "concat"]])).toMatchObject(["ab"]);
    expect(
      calculate([["("], "a/", ["["], "b", "c", ["]"], "/d", [")", "concat"]])
    ).toMatchObject(["a/b/d", "a/c/d"]);
  });
});
