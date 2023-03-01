import { describe, expect, it } from "vitest";
import {
  Computation,
  DocumentId,
  FieldId,
  TemplateFieldId,
  Value,
} from "../types";
import {
  calculateSync as calculateSync_,
  calculateAsync as calculateAsync_,
} from "../calculate";

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
      }, 5);
    });
  };
  return calculateAsync_("root", comp, getter);
};

const calculate = (comp: Computation, imports: ComputationBlock[] = []) => {
  const getter = (id: string, returnFunction: boolean) => {
    const block = imports.find((el) => el.id == id);
    if (!block) return;
    const value = calculateSync_(id, block.value, getter, {
      returnFunction,
    });
    return value;
  };
  return calculateSync_("root", comp, getter);
};

const test = async (
  computation: Computation,
  result: Value[],
  imports?: ComputationBlock[]
) => {
  expect(calculate(computation, imports)).toMatchObject(result);
  expect(await calculateAsync(computation, imports)).toMatchObject(result);
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
      { id: "imp", fref: "a" as FieldId, args: {} },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
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
          { id: "imp", fref: "b" as FieldId, args: {} },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
      { ")": "*" },
    ];
    const result: Value[] = [2 * (6 / 2)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
    ];

    return test(computation, result, imports);
  });
  it("replaces parameter with args 1", () => {
    const computation: Computation = [
      { id: "imp", fref: "a" as FieldId, args: {} },
    ];

    const result: Value[] = [2];

    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
      { id: "root.imp/0", value: [3] },
    ];

    return test(computation, result, imports);
  });
  it("replaces parameter with args 2", () => {
    const computation: Computation = [
      { "(": true },
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
      { ")": "*" },
    ];
    const result: Value[] = [2 * (6 / 3)];
    const imports: ComputationBlock[] = [
      { id: "a", value: [{ "(": true }, 6, { x: 0, value: 2 }, { ")": "/" }] },
      { id: "root.imp/0", value: [3] },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
    ];
    const imports: ComputationBlock[] = [{ id: "a", value: [3, 4, 5] }];
    const result: Value[] = [1, 2, 3, 4, 5];

    return test(computation, result, imports);
  });
  it("handles import of nested array into array", () => {
    const computation: Computation = [
      1,
      2,
      { id: "imp", fref: "a" as FieldId, args: {} },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
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
  const list = [
    {
      id: "a" as DocumentId,
      values: {
        ["firstname" as TemplateFieldId]: ["Martin"],
        ["lastname" as TemplateFieldId]: ["Vase"],
        ["description" as TemplateFieldId]: [
          "Martin Vase",
          "Martin Vase",
          "Martin Vase",
        ],
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

  const imports: ComputationBlock[] = [
    { id: "a", value: list },
    { id: "abcdfirstname" as TemplateFieldId, value: ["Malene"] },
    { id: "abcdlastname" as TemplateFieldId, value: ["Hansen"] },
    {
      id: "abcddescription" as TemplateFieldId,
      value: ["Malene Hansen", "Malene Hansen", "Malene Hansen"],
    },
  ];

  it("picks column", () => {
    const computation: Computation = [
      { "(": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
      { p: "firstname" as TemplateFieldId },
    ];
    const result: Value[] = ["Martin", "Peter", "Martin", "Peter", "Malene"];
    return test(computation, result, imports);
  });

  it("picks two columns", () => {
    const computation: Computation = [
      { "(": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
      { p: "firstname" as TemplateFieldId },
      { "(": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
      { p: "firstname" as TemplateFieldId },
      { "]": true },
      { "[": true },
      { "(": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
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
      { id: "imp", fref: "a" as FieldId, args: {} },
      { p: "description" as TemplateFieldId },
    ];
    const result: Value[] = [
      ["Martin Vase", "Martin Vase", "Martin Vase"],
      ["Peter Hansen", "Peter Hansen", "Peter Hansen"],
      ["Martin Hansen", "Martin Hansen", "Martin Hansen"],
      ["Peter Vase", "Peter Vase", "Peter Vase"],
      ["Malene Hansen", "Malene Hansen", "Malene Hansen"],
    ];
    return test(computation, result, imports);
  });
});

describe("calculator merge", () => {
  it("should merge imports with strings", () => {
    const computation: Computation = [
      { "{": true },
      "a",
      {
        id: "imp",
        fref: "a" as FieldId,
        args: {},
      },
      "c",
      { "}": true },
    ];

    const imports: ComputationBlock[] = [
      {
        id: "a",
        value: [0],
      },
    ];

    const result: Value[] = ["a0c"];

    return test(computation, result, imports);
  });

  it("should disregard paragraphs in imports if they are added inline", () => {
    const computation: Computation = [
      { "{": true },
      "a",
      {
        id: "imp",
        fref: "a" as FieldId,
        args: {},
      },
      "c",
      { "}": true },
    ];

    const imports: ComputationBlock[] = [
      {
        id: "a",
        value: ["hej", "test", "goddag"],
      },
    ];

    const result: Value[] = ["ahejc"];

    return test(computation, result, imports);
  });

  it("should merge with respect for paragraphs in imports if they are on a new line", () => {
    const computation: Computation = [
      { "{": true },
      "a",
      { "/": true },
      {
        id: "imp",
        fref: "a" as FieldId,
        args: {},
      },
      { "/": true },
      "c",
      { "}": true },
    ];

    const imports: ComputationBlock[] = [
      {
        id: "a",
        value: ["hej", "test", "goddag"],
      },
    ];

    const result: Value[] = ["a", ["hej", "test", "goddag"], "c"];

    return test(computation, result, imports);
  });

  it("should not merge across object elements", () => {
    const computation: Computation = [
      { "{": true },
      "a",
      {
        id: "",
        type: "Element",
        props: {},
      },
      "c",
      { "}": true },
    ];

    const result: Value[] = [
      "a",
      {
        id: "",
        type: "Element",
        props: {},
      },
      "c",
    ];
    return test(computation, result);
  });

  it("should add empty string between adjacent linebreaks", () => {
    const computation: Computation = [
      { "{": true },
      "a",
      { "/": true },
      { "/": true },
      "b",
      { "}": true },
    ];

    const result: Value[] = ["a", "", "b"];

    return test(computation, result);
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

describe("calculator in function", () => {
  it("should return true if the value is in the array", () => {
    const computation: Computation = [
      { "(": true },
      1,
      { "[": true },
      1,
      2,
      3,
      { "]": true },
      { ")": "in" },
    ];
    const result: Value[] = [true];
    return test(computation, result);
  });
  it("should return false if the value is in the array", () => {
    const computation: Computation = [
      { "(": true },
      "bla",
      { "[": true },
      "blo",
      "blu",
      "bli",
      { "]": true },
      { ")": "in" },
    ];
    const result: Value[] = [false];
    return test(computation, result);
  });
  it("should return true if the value is in imported implicit array", () => {
    const computation: Computation = [
      { "(": true },
      "bla",
      { id: "imp", fref: "a" as FieldId, args: {} },
      { ")": "in" },
    ];
    const result: Value[] = [true];
    const imports: ComputationBlock[] = [
      { id: "a", value: ["bla", "blu", "bli"] },
    ];
    return test(computation, result, imports);
  });
  it("should return true if one of multiple values is in imported implicit array", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      "bla",
      "blo",
      { "]": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
      { ")": "in" },
    ];
    const result: Value[] = [true];
    const imports: ComputationBlock[] = [
      { id: "a", value: ["bla", "blu", "bli"] },
    ];
    return test(computation, result, imports);
  });
  it("should return false if NONE of multiple values is in imported implicit array", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      "bly",
      "blo",
      { "]": true },
      { id: "imp", fref: "a" as FieldId, args: {} },
      { ")": "in" },
    ];
    const result: Value[] = [false];
    const imports: ComputationBlock[] = [
      { id: "a", value: ["bla", "blu", "bli"] },
    ];
    return test(computation, result, imports);
  });
});

describe("calculator filter function", () => {
  it("should filter out all elements that are not equal to the filter value", () => {
    const computation: Computation = [
      { "(": true },
      { "[": true },
      0,
      1,
      2,
      3,
      { "]": true },
      { "(": true },
      { "[": true },
      1,
      0,
      1,
      0,
      { "]": true },
      1,
      { ")": "=" },
      { ")": "filter" },
    ];
    const result: Value[] = [0, 2];
    return test(computation, result);
  });
});
