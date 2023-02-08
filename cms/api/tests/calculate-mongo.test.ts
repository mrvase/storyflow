import { describe, expect, it } from "vitest";
import { operators } from "../aggregation/js-operators";
import {
  calculate as _calculate,
  FlatComputation,
} from "../aggregation/calculate";
import {
  DocumentId,
  DocumentImport,
  FieldId,
  FlatNestedDocument,
  NestedDocument,
  TemplateFieldId,
} from "@storyflow/backend/types";

type Computation = FlatComputation;

type ComputationBlock = {
  id: string;
  value: FlatComputation;
};

type Value = any;

const calculate = (value: FlatComputation, imports_: ComputationBlock[]) => {
  let results: ComputationBlock[] = [];

  imports_.forEach((el) => {
    const importWithResult = {
      ...el,
      ..._calculate(operators, el as any, [...(results as any), ...imports_]),
    };
    results.push(importWithResult);
  });

  return _calculate(operators, { id: "root" as FieldId, value }, results as any)
    .result;
};

const test = (
  value: FlatComputation,
  result: Value[],
  imports: ComputationBlock[] = []
) => {
  expect(calculate(value, imports)).toMatchObject(result);
};

const flattenList = (list_: (NestedDocument | DocumentImport)[]) => {
  const flatList: (FlatNestedDocument | DocumentImport)[] = [];
  const listImports: ComputationBlock[] = [];
  for (const item of list_) {
    if ("id" in item) {
      flatList.push({ id: item.id });
      for (const key in item.values) {
        listImports.push({
          id: `${item.id}/${key}` as FieldId,
          value: item.values[key as TemplateFieldId] as FlatComputation,
        });
      }
    } else {
      flatList.push(item);
    }
  }
  return [flatList, listImports] as const;
};

describe("calculator - simple arithmetics", () => {
  it("multiplies", () => {
    const computation: Computation = [{ "(": true }, 2, 5, { ")": "*" }];
    const result: Value[] = [2 * 5];

    return test(computation, result);
  });
  it("adds", () => {
    const computation: Computation = [{ "(": true }, 2, 5, { ")": "+" }];
    const result: Value[] = [2 + 5];

    return test(computation, result);
  });
  it("divides", () => {
    const computation: Computation = [{ "(": true }, 2, 5, { ")": "/" }];
    const result: Value[] = [2 / 5];

    return test(computation, result);
  });
  it("subtracts", () => {
    const computation: Computation = [{ "(": true }, 2, 5, { ")": "-" }];
    const result: Value[] = [2 - 5];

    return test(computation, result);
  });
});

describe("calculator - complex arithmetics", () => {
  it("multiplies many numbers", () => {
    const computation: Computation = [{ "(": true }, 2, 5, 3, 4, { ")": "*" }];
    const result: Value[] = [2 * 5 * 3 * 4];

    return test(computation, result);
  });
  it("handles nested operations", () => {
    const computation: Computation = [
      { "(": true },
      { "(": true },
      5,
      3,
      { ")": "+" },
      2,
      { ")": "*" },
    ];
    const result: Value[] = [(5 + 3) * 2];

    return test(computation, result);
  });
});

describe("calculator - imports", () => {
  it("operates on single import", () => {
    const computation: Computation = [
      { "(": true },
      2,
      { id: "imp", fref: "a" as FieldId },
      { ")": "*" },
    ];
    const result: Value[] = [2 * 5];
    const imports: ComputationBlock[] = [{ id: "a", value: [5] }];

    return test(computation, result, imports);
  });
  it("operates on nested imports", () => {
    const computation: Computation = [
      { "(": true },
      2,
      { id: "imp", fref: "a" as FieldId },
      { ")": "*" },
    ];
    const result: Value[] = [2 * (5 - 3 - 1)];

    const imports: ComputationBlock[] = [
      { id: "b", value: [3] },
      {
        id: "a",
        value: [
          { "(": true },
          5,
          { id: "imp", fref: "b" as FieldId },
          1,
          { ")": "-" },
        ],
      },
    ];

    return test(computation, result, imports);
  });
});

describe("calculator - functions", () => {
  it("replaces parameter with default value when no args are provided", () => {
    const computation: Computation = [
      { "(": true },
      2,
      { id: "imp", fref: "a" as FieldId },
      { ")": "*" },
    ];
    const result: Value[] = [2 * (6 / 2)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
    ];

    return test(computation, result, imports);
  });
  it("replaces parameter with args", () => {
    const computation: Computation = [{ id: "imp", fref: "a" as FieldId }];

    const result: Value[] = [2];

    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
      { id: "imp/0", value: [3] },
    ];

    return test(computation, result, imports);
  });
  it("replaces parameter with args", () => {
    const computation: Computation = [
      { "(": true },
      2,
      { id: "imp", fref: "a" as FieldId },
      { ")": "*" },
    ];
    const result: Value[] = [2 * (6 / 3)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
      { id: "imp/0", value: [3] },
    ];

    return test(computation, result, imports);
  });
});

describe("calculator - brackets", () => {
  it("ignores brackets 1", () => {
    const computation: Computation = [{ "(": true }, 1, 2, { ")": true }];
    const result: Value[] = [1, 2];

    return test(computation, result);
  });
  it("ignores brackets 2", () => {
    const computation: Computation = [1, { "(": true }, 2, 3, { ")": true }, 4];
    const result: Value[] = [1, 2, 3, 4];

    return test(computation, result);
  });
});

describe("calculator - arrays", () => {
  it("handles single array", () => {
    const computation: Computation = [{ "[": true }, 2, 3, { "]": true }];
    const result: Value[] = [[2, 3]];

    return test(computation, result);
  });
  it("handles array among primitive values", () => {
    const computation: Computation = [1, { "[": true }, 2, 3, { "]": true }, 4];
    const result: Value[] = [1, [2, 3], 4];

    return test(computation, result);
  });
  it("handles nested arrays", () => {
    const computation: Computation = [
      1,
      { "[": true },
      2,
      { "[": true },
      3,
      { "[": true },
      4,
      5,
      { "]": true },
      { "]": true },
      6,
      { "]": true },
    ];
    const result: Value[] = [1, [2, [3, [4, 5]], 6]];

    return test(computation, result);
  });
});

describe("calculator - imports and arrays", () => {
  it("handles import of array into array", () => {
    const computation: Computation = [
      1,
      2,
      { id: "imp", fref: "a" as FieldId },
    ];
    const imports: ComputationBlock[] = [{ id: "a", value: [3, 4, 5] }];
    const result: Value[] = [1, 2, 3, 4, 5];

    return test(computation, result, imports);
  });
  it("handles import of nested array into array", () => {
    const computation: Computation = [
      1,
      2,
      { id: "imp", fref: "a" as FieldId },
    ];
    const imports: ComputationBlock[] = [
      { id: "a", value: [3, { "[": true }, 4, 5, { "]": true }] },
    ];
    const result: Value[] = [1, 2, 3, [4, 5]];

    return test(computation, result, imports);
  });
  it("handles import of array element", () => {
    const computation: Computation = [
      { "[": true },
      1,
      2,
      { "]": true },
      3,
      { id: "imp", fref: "a" as FieldId },
    ];
    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "[": true }, 4, 5, { "]": true }, 6] },
    ];
    const result: Value[] = [[1, 2], 3, [4, 5], 6];

    return test(computation, result, imports);
  });
  it("can multiply array with number", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      2,
      3,
      { "]": true },
      3,
      { ")": "*" },
    ];
    const result: Value[] = [6, 9];

    return test(computation, result);
  });

  it("can multiply array with two numbers", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      2,
      3,
      { "]": true },
      3,
      2,
      { ")": "*" },
    ];
    const result: Value[] = [12, 18];

    return test(computation, result);
  });

  it("can multiply array with array", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      1,
      2,
      { "]": true },
      { "[": true },
      3,
      4,
      { "]": true },
      { ")": "*" },
    ];
    const result: Value[] = [3, 6, 4, 8];

    return test(computation, result);
  });
});

describe("calculator functions", () => {
  it("concatenates string", () => {
    const computation: Computation = [
      { "(": true },
      "a",
      "b",
      { ")": "concat" },
    ];
    const result: Value[] = ["ab"];
    return test(computation, result);
  });

  it("concatenates string element-wise", () => {
    const computation: Computation = [
      { "(": true },
      "a/",
      { "[": true },
      "b",
      "c",
      { "]": true },
      "/d",
      { ")": "concat" },
    ];
    const result: Value[] = ["a/b/d", "a/c/d"];
    return test(computation, result);
  });

  it("works with slug", () => {
    const computation: Computation = [
      { "(": true },
      "Dette er en test",
      " ",
      "og jeg håber, det virker",
      { ")": "slug" },
    ];
    const result: Value[] = ["dette-er-en-test-og-jeg-haaber-det-virker"];
    return test(computation, result);
  });

  it("works with url", () => {
    const computation: Computation = [
      { "(": true },
      "Dette er en test",
      "men virker det?",
      { ")": "url" },
    ];
    const result: Value[] = ["dette-er-en-test/men-virker-det"];
    return test(computation, result);
  });
});

describe("calculator pick function", () => {
  const list: (NestedDocument | DocumentImport)[] = [
    {
      id: "a" as DocumentId,
      values: {
        ["firstname" as TemplateFieldId]: ["Martin"],
        ["lastname" as TemplateFieldId]: ["Vase"],
        ["description" as TemplateFieldId]: ["Martin Vase"],
      },
    },
    {
      id: "b" as DocumentId,
      values: {
        ["firstname" as TemplateFieldId]: ["Peter"],
        ["lastname" as TemplateFieldId]: ["Hansen"],
        ["description" as TemplateFieldId]: [
          "Peter Hansen",
          "Peter Hansen",
          "Peter Hansen",
        ],
      },
    },
    {
      id: "c" as DocumentId,
      values: {
        ["firstname" as TemplateFieldId]: ["Martin"],
        ["lastname" as TemplateFieldId]: ["Hansen"],
        ["description" as TemplateFieldId]: [
          "Martin Hansen",
          "Martin Hansen",
          "Martin Hansen",
        ],
      },
    },
    {
      id: "d" as DocumentId,
      values: {
        ["firstname" as TemplateFieldId]: ["Peter"],
        ["lastname" as TemplateFieldId]: ["Vase"],
        ["description" as TemplateFieldId]: [
          "Peter Vase",
          "Peter Vase",
          "Peter Vase",
        ],
      },
    },
    {
      dref: "abcd" as DocumentId,
    },
  ];

  const [flatList, listImports] = flattenList(list);

  const imports: ComputationBlock[] = [
    ...listImports,
    { id: "a", value: flatList },
    { id: "abcdfirstname" as TemplateFieldId, value: ["Malene"] },
    { id: "abcdlastname" as TemplateFieldId, value: ["Hansen"] },
    {
      id: "abcddescription" as TemplateFieldId,
      value: ["Malene Hansen", "Malene Hansen", "Malene Hansen"],
    },
  ];

  console.log("IMPORTS", imports);

  it("picks column", () => {
    const computation: Computation = [
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "firstname" as TemplateFieldId },
    ];
    const result: Value[] = ["Martin", "Peter", "Martin", "Peter", "Malene"];
    return test(computation, result, imports);
  });

  it("picks two columns", () => {
    const computation: Computation = [
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "firstname" as TemplateFieldId },
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "lastname" as TemplateFieldId },
    ];
    const result: Value[] = [
      "Martin",
      "Peter",
      "Martin",
      "Peter",
      "Malene",
      "Vase",
      "Hansen",
      "Hansen",
      "Vase",
      "Hansen",
    ];
    return test(computation, result, imports);
  });

  it("picks two columns in arrays", () => {
    const computation: Computation = [
      { "[": true },
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "firstname" as TemplateFieldId },
      { "]": true },
      { "[": true },
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "lastname" as TemplateFieldId },
      { "]": true },
    ];
    const result: Value[] = [
      ["Martin", "Peter", "Martin", "Peter", "Malene"],
      ["Vase", "Hansen", "Hansen", "Vase", "Hansen"],
    ];
    return test(computation, result, imports);
  });

  it("preserves arrays in column of arrays", () => {
    const computation: Computation = [
      { "(": true },
      { id: "imp", fref: "a" as FieldId },
      { p: "description" as TemplateFieldId },
    ];
    const result: Value[] = [
      "Martin Vase",
      ["Peter Hansen", "Peter Hansen", "Peter Hansen"],
      ["Martin Hansen", "Martin Hansen", "Martin Hansen"],
      ["Peter Vase", "Peter Vase", "Peter Vase"],
      ["Malene Hansen", "Malene Hansen", "Malene Hansen"],
    ];
    return test(computation, result, imports);
  });
});

describe("calculator logical operators", () => {
  it("evaluates equals function to true", () => {
    const computation: Computation = [{ "(": true }, 1, 1, { ")": "=" }];
    const result: Value[] = [true];
    return test(computation, result);
  });
  it("evaluates equals function to false", () => {
    const computation: Computation = [{ "(": true }, 1, 2, { ")": "=" }];
    const result: Value[] = [false];
    return test(computation, result);
  });
  it("handles array", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      1,
      2,
      { "]": true },
      2,
      { ")": "=" },
    ];
    const result: Value[] = [false, true];
    return test(computation, result);
  });
});

/*
describe("aggregation calculator", () => {
  it("handles simple calculation", () => {
    expect(calculate([["("], 25, 3, [")", "*"]])).toMatchObject([75]);
    expect(calculate([["("], 2, 3, [")", "+"]])).toMatchObject([5]);
    expect(calculate([["("], 3, 1, 100, [")", "+"]])).toMatchObject([104]);
    expect(calculate([["("], 5, 2, [")", "*"]])).toMatchObject([10]);
    expect(calculate([["("], 2, 3, 100, [")", "*"]])).toMatchObject([600]);
    expect(calculate([["("], 2, 3, [")", "="]])).toMatchObject([false]);
    expect(calculate([["("], 2, ["("], 2, 3, [")"], [")", "="]])).toMatchObject(
      [true, false]
    );
  });
  it("can multiply array with array", () => {
    expect(calculate([["("], ["("], 2, 3, [")"], 3, [")", "*"]])).toMatchObject(
      [6, 9]
    );
    expect(
      calculate([["("], ["("], 2, 3, [")"], 3, 2, [")", "*"]])
    ).toMatchObject([12, 18]);
    expect(
      calculate([["("], ["("], 1, 2, [")"], ["("], 3, 4, [")"], [")", "*"]])
    ).toMatchObject([3, 6, 4, 8]);
  });
  it("handles operations with arrays", () => {
    const compute = [
      2,
      1,
      ["("],
      2,
      3,
      ["("],
      ["("],
      5,
      4,
      3,
      [")"],
      2,
      [")", "*"],
      6,
      [")", "+"],
      1,
    ] as FlatComputation;
    expect(calculate(compute)).toMatchObject([2, 1, 21, 19, 17, 1]);
  });
  it("combines arrays", () => {
    expect(calculate(["a", "b", "c", "d"])).toMatchObject(["a", "b", "c", "d"]);
    expect(
      calculate([["("], "a", "b", [")"], ["("], "c", "d", [")"]])
    ).toMatchObject(["a", "b", "c", "d"]);
    expect(calculate([["("], "a", "b", [")"], "c", "d"])).toMatchObject([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
  it("calculates whether array contains value (in operator)", () => {
    expect(
      calculate([["("], "a", ["("], "a", "b", [")"], [")", "in"]])
    ).toMatchObject([true]);
    expect(
      calculate([
        ["("],
        true,
        ["("],
        ["("],
        "a",
        ["("],
        "a",
        "b",
        [")"],
        [")", "in"],
        ["("],
        "c",
        ["("],
        "a",
        "b",
        [")"],
        [")", "in"],
        [")"],
        [")", "in"],
      ])
    ).toMatchObject([true]);
  });
  it("ignores double array", () => {
    expect(calculate([["("], ["("], "a", "b", [")"], [")"]])).toMatchObject([
      "a",
      "b",
    ]);
  });
  it("concatenates string", () => {
    expect(calculate([["("], "a", "b", [")", "concat"]])).toMatchObject(["ab"]);
    expect(
      calculate([["("], "a/", ["("], "b", "c", [")"], "/d", [")", "concat"]])
    ).toMatchObject(["a/b/d", "a/c/d"]);
  });
  it("works with slug and url", () => {
    expect(
      calculate([
        ["("],
        "Dette er en test",
        " ",
        "og jeg håber, det virker",
        [")", "slug"],
      ])
    ).toMatchObject(["dette-er-en-test-og-jeg-haaber-det-virker"]);
    expect(
      calculate([["("], "Dette er en test", "men virker det?", [")", "url"]])
    ).toMatchObject(["dette-er-en-test/men-virker-det"]);
  });
});
*/
