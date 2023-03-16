import {
  BrandedObjectId,
  FieldId,
  NestedDocumentId,
  RawFieldId,
} from "@storyflow/backend/types";
import {
  DBSyntaxStream,
  SyntaxTree,
  TokenStream,
  WithSyntaxError,
} from "@storyflow/backend/types2";
import { expect, describe, it } from "vitest";
import {
  createSyntaxStream,
  createTokenStream,
  parseSyntaxStream,
  parseTokenStream,
} from "../../parse";

type Test = {
  description?: string;
  skip?: boolean;
  tokens: TokenStream;
  syntax: SyntaxTree<WithSyntaxError>;
  stream: DBSyntaxStream;
};

const createTests = (tests: Test[]) => {
  return tests;
};

const runTest = (test: Test, index: number) => {
  const func = test.skip ? it.skip : it;
  func(test.description ?? `Test ${index + 1}`, () => {
    // parseTokenStream
    expect(parseTokenStream(test.tokens)).toMatchObject(test.syntax);
    expect(test.syntax).toMatchObject(parseTokenStream(test.tokens));

    expect(createTokenStream(test.syntax)).toMatchObject(test.tokens);
    expect(test.tokens).toMatchObject(createTokenStream(test.syntax));

    // createSyntaxStream
    if ("stream" in test && test.stream) {
      expect(createSyntaxStream(test.syntax)).toMatchObject(test.stream);
      expect(test.stream).toMatchObject(createSyntaxStream(test.syntax));

      // parseSyntaxStream
      expect(parseSyntaxStream(test.stream)).toMatchObject(test.syntax);
      expect(test.syntax).toMatchObject(parseSyntaxStream(test.stream));
    }
  });
};

describe("editor computation - operations", () => {
  const tests = createTests([
    {
      tokens: [5, { _: "*" }, 2],
      syntax: { type: null, children: [{ type: "*", children: [5, 2] }] },
      stream: [{ "(": true }, 5, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, 2, { _: "*" }, 2, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [{ type: "*", children: [2, 2, 2, 2] }],
      },
      stream: [{ "(": true }, 2, 2, 2, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "+" }, 2, { _: "+" }, 2, { _: "+" }, 2],
      syntax: {
        type: null,
        children: [{ type: "+", children: [2, 2, 2, 2] }],
      },
      stream: [{ "(": true }, 2, 2, 2, 2, { ")": "+" }],
    },

    {
      tokens: [2, { _: "*" }, { "(": true }, 2, { _: "+" }, 2, { ")": true }],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [
              2,
              {
                type: null, // parenthesis
                children: [
                  {
                    type: "+",
                    children: [2, 2],
                  },
                ],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        2,
        { "(": true },
        2,
        2,
        { ")": "+" },
        { ")": "*" },
      ],
    },

    {
      tokens: [
        2,
        { _: "*" },
        { "(": true },
        2,
        { _: "+" },
        2,
        { _: "*" },
        { "(": true },
        2,
        { _: "+" },
        2,
        { _: "*" },
        2,
        { ")": true },
        { ")": true },
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [
              2,
              {
                type: null,
                children: [
                  {
                    type: "+",
                    children: [
                      2,
                      {
                        type: "*",
                        children: [
                          2,
                          {
                            type: null,
                            children: [
                              {
                                type: "+",
                                children: [2, { type: "*", children: [2, 2] }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        2,
        { "(": true },
        2,
        { "(": true },
        2,
        { "(": true },
        2,
        { "(": true },
        2,
        2,
        { ")": "*" },
        { ")": "+" },
        { ")": "*" },
        { ")": "+" },
        { ")": "*" },
      ],
    },
  ]);

  tests.forEach(runTest);
});

describe("editor computation - brackets", () => {
  const tests = createTests([
    {
      description: "Save unecessary brackets",
      tokens: [{ "(": true }, 3, { _: "+" }, 2, { ")": true }],
      syntax: {
        type: null,
        children: [{ type: null, children: [{ type: "+", children: [3, 2] }] }],
      },
      stream: [{ "(": true }, { "(": true }, 3, 2, { ")": "+" }, { ")": true }],
    },

    {
      description: "Operation in function",
      tokens: [{ "(": true }, 5, { _: "*" }, 2, { ")": "slug" }],
      syntax: {
        type: null,
        children: [
          {
            type: "slug",
            children: [
              {
                type: "*",
                children: [5, 2],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "(": true },
        5,
        2,
        { ")": "*" },
        { ")": "slug" },
      ],
    },

    {
      description: "handles parentheses in operations 1",
      tokens: [5, { _: "*" }, { "(": true }, 3, { _: "+" }, 2, { ")": true }],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [
              5,
              {
                type: null,
                children: [
                  {
                    type: "+",
                    children: [3, 2],
                  },
                ],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        5,
        { "(": true },
        3,
        2,
        { ")": "+" },
        { ")": "*" },
      ],
    },

    {
      description: "handles parentheses in operations 2",
      tokens: [
        { "(": true },
        3,
        { _: "+" },
        2,
        { _: "*" },
        4,
        { ")": true },
        { _: "/" },
        2,
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "/",
            children: [
              {
                type: null,
                children: [
                  {
                    type: "+",
                    children: [
                      3,
                      {
                        type: "*",
                        children: [2, 4],
                      },
                    ],
                  },
                ],
              },
              2,
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "(": true },
        3,
        { "(": true },
        2,
        4,
        { ")": "*" },
        { ")": "+" },
        2,
        { ")": "/" },
      ],
    },
  ]);

  tests.forEach(runTest);
});

const NestedField = {
  id: "" as NestedDocumentId,
  field: "aaaa" as FieldId,
};

const NestedFieldInline = {
  id: "" as NestedDocumentId,
  field: "aaaa" as FieldId,
  inline: true as true,
};

const DBNestedField = {
  id: "" as unknown as BrandedObjectId<NestedDocumentId>,
  field: "aaaa" as unknown as BrandedObjectId<FieldId>,
};

const DBNestedFieldInline = {
  id: "" as unknown as BrandedObjectId<NestedDocumentId>,
  field: "aaaa" as unknown as BrandedObjectId<FieldId>,
  inline: true as true,
};

describe("editor computation - objects and arrays", () => {
  const tests = createTests([
    {
      description: "can handle imports",
      tokens: [
        5,
        { _: "*" },
        { "(": true },
        NestedField,
        { _: "+" },
        { x: 0 },
        { ")": true },
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [
              5,
              {
                type: null,
                children: [
                  {
                    type: "+",
                    children: [NestedField, { x: 0 }],
                  },
                ],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        5,
        { "(": true },
        NestedField,
        { x: 0 },
        { ")": "+" },
        { ")": "*" },
      ],
    },

    {
      description: "can handle arrays",
      tokens: [5, { ",": true }, 1, { ",": true }, 0],
      syntax: {
        type: null,
        children: [5, 1, 0],
      },
      stream: [5, 1, 0],
    },
  ]);

  tests.forEach(runTest);
});

describe("auto-merging inline elements and not block elements", () => {
  const tests = createTests([
    {
      tokens: ["Hej", NestedFieldInline],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: ["Hej", NestedFieldInline],
          },
        ],
      },
      stream: [{ "{": true }, "Hej", NestedFieldInline, { "}": true }],
    },

    {
      tokens: ["Hej", NestedField],
      syntax: {
        type: null,
        children: ["Hej", NestedField],
      },
      stream: ["Hej", NestedField],
    },

    {
      tokens: ["Hej", { ",": true }, NestedFieldInline],
      syntax: {
        type: null,
        children: ["Hej", NestedFieldInline],
      },
      stream: ["Hej", NestedFieldInline],
    },

    {
      tokens: ["Hej", { ",": true }, NestedFieldInline, "."],
      syntax: {
        type: null,
        children: [
          "Hej",
          {
            type: "merge",
            children: [NestedFieldInline, "."],
          },
        ],
      },
      stream: ["Hej", { "{": true }, NestedFieldInline, ".", { "}": true }],
    },

    {
      tokens: ["Hej", { n: true }, NestedFieldInline, "."],
      syntax: {
        type: null,
        children: [
          "Hej",
          { n: true },
          {
            type: "merge",
            children: [NestedFieldInline, "."],
          },
        ],
      },
      stream: [
        "Hej",
        { n: true },
        { "{": true },
        NestedFieldInline,
        ".",
        { "}": true },
      ],
    },

    {
      tokens: [
        NestedField,
        NestedField,
        { "(": true },
        2,
        { ",": true },
        3,
        { ")": "slug" },
        NestedField,
      ],
      syntax: {
        type: null,
        children: [
          NestedField,
          NestedField,
          {
            type: "slug",
            children: [2, 3],
          },
          NestedField,
        ],
      },
      stream: [
        NestedField,
        NestedField,
        { "(": true },
        2,
        3,
        { ")": "slug" },
        NestedField,
      ],
    },

    {
      tokens: [
        NestedFieldInline,
        "Tester",
        { "(": true },
        2,
        { ",": true },
        3,
        { ")": "slug" },
        "Hmmm",
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: [
              NestedFieldInline,
              "Tester",
              {
                type: "slug",
                children: [2, 3],
              },
              "Hmmm",
            ],
          },
        ],
      },
      stream: [
        { "{": true },
        NestedFieldInline,
        "Tester",
        { "(": true },
        2,
        3,
        { ")": "slug" },
        "Hmmm",
        { "}": true },
      ],
    },

    {
      tokens: [
        NestedFieldInline,
        "Tester",
        { "(": true },
        5,
        { _: "*" },
        2,
        { ")": true },
        "Hmmm",
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: [
              NestedFieldInline,
              "Tester",
              {
                type: null,
                children: [
                  {
                    type: "*",
                    children: [5, 2],
                  },
                ],
              },
              "Hmmm",
            ],
          },
        ],
      },
      stream: [
        { "{": true },
        NestedFieldInline,
        "Tester",
        { "(": true },
        { "(": true },
        5,
        2,
        { ")": "*" },
        { ")": true },
        "Hmmm",
        { "}": true },
      ],
    },
  ]);

  tests.forEach(runTest);
});

describe("operator syntax errors", () => {
  const tests = createTests([
    {
      tokens: [{ _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [{ missing: "number" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, null as any, 2, { ")": "*" }],
    },

    {
      tokens: [{ _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [{ missing: "number" }, { missing: "number" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, null as any, null as any, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2],
          },
        ],
      },
      stream: [{ "(": true }, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { missing: "number" }],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { missing: "number" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { missing: "number" }, { missing: "number" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, null as any, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, 2, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { missing: "number" }, 2, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, 2, 2, { ")": "*" }],
    },

    {
      tokens: [2, { _: "*" }, 2, { _: "+" }],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [{ type: "*", children: [2, 2] }],
          },
        ],
      },
      stream: [{ "(": true }, { "(": true }, 2, 2, { ")": "*" }, { ")": "+" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "+" }],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [{ type: "*", children: [2] }],
          },
        ],
      },
      stream: [{ "(": true }, { "(": true }, 2, { ")": "*" }, { ")": "+" }],
    },

    {
      tokens: [2, { _: "*" }, { _: "+" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [{ type: "*", children: [2] }, 2],
          },
        ],
      },
      stream: [{ "(": true }, { "(": true }, 2, { ")": "*" }, 2, { ")": "+" }],
    },

    {
      tokens: [2, { _: "+" }, 2, { _: "*" }],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [2, { type: "*", children: [2] }],
          },
        ],
      },
      stream: [{ "(": true }, 2, { "(": true }, 2, { ")": "*" }, { ")": "+" }],
    },

    {
      tokens: [2, { _: "+" }, { _: "*" }],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [2, { type: "*", children: [] }],
          },
        ],
      },
      stream: [{ "(": true }, 2, { "(": true }, { ")": "*" }, { ")": "+" }],
    },

    {
      tokens: [2, { _: "+" }, { _: "*" }, { _: "+" }],
      syntax: {
        type: null,
        children: [
          {
            type: "+",
            children: [
              2,
              { type: "+", children: [{ type: "*", children: [] }] },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        2,
        { "(": true },
        { "(": true },
        { ")": "*" },
        { ")": "+" },
        { ")": "+" },
      ],
    },
  ]);

  tests.forEach(runTest);
});

describe("bracket syntax errors", () => {
  const tests = createTests([
    {
      tokens: [{ "(": true }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: null,
            children: [2],
            open: true, // <-- HERE
          },
        ],
      },
      stream: [{ "(": true }, 2], // relies on auto-close mechanism
    },

    {
      tokens: [2, { ")": true }],
      syntax: {
        type: null,
        children: [2, { error: ")" }],
      },
      stream: [2, { ")": false }], // will be ignored
    },

    {
      tokens: [2, { _: "*" }, 3, { ")": true }],
      syntax: {
        type: null,
        children: [{ type: "*", children: [2, 3] }, { error: ")" }],
      },
      stream: [{ "(": true }, 2, 3, { ")": "*" }, { ")": false }], // will be ignored
    },
  ]);

  tests.forEach(runTest);
});

describe("comma syntax errors", () => {
  const tests = createTests([
    {
      tokens: [{ ",": true }, 2],
      syntax: {
        type: null,
        children: [{ error: "," }, 2],
      },
      stream: [null as any, 2],
    },

    {
      tokens: [{ ",": true }, { ",": true }, 2],
      syntax: {
        type: null,
        children: [{ error: "," }, { error: "," }, 2],
      },
      stream: [null as any, null as any, 2],
    },

    {
      tokens: [2, { ",": true }],
      syntax: {
        type: null,
        children: [2, { error: "," }],
      },
      stream: [2, null as any],
    },

    {
      tokens: [2, { ",": true }, { ",": true }],
      syntax: {
        type: null,
        children: [2, { error: "," }, { error: "," }],
      },
      stream: [2, null as any, null as any],
    },

    {
      tokens: [{ "(": true }, 2, { ",": true }, { ",": true }],
      syntax: {
        type: null,
        children: [
          {
            type: null,
            children: [2, { error: "," }, { error: "," }],
            open: true,
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, null as any],
    },

    {
      tokens: [{ "(": true }, 2, { ",": true }, { ")": true }],
      syntax: {
        type: null,
        children: [{ type: null, children: [2, { error: "," }] }],
      },
      stream: [{ "(": true }, 2, null as any, { ")": true }],
    },

    {
      tokens: ["Hej", { ",": true }, { n: true }],
      syntax: {
        type: null,
        children: ["Hej", { error: "," }, { n: true }],
      },
      stream: ["Hej", null as any, { n: true }],
    },

    {
      tokens: [NestedField, { ",": true }, NestedField],
      syntax: {
        type: null,
        children: [NestedField, { error: "," }, NestedField],
      },
      stream: [NestedField, null as any, NestedField],
    },
  ]);

  tests.forEach(runTest);
});

describe("comma / merge syntax errors", () => {
  const tests = createTests([
    {
      tokens: ["hej", NestedFieldInline, "test", { ",": true }, NestedField],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: ["hej", NestedFieldInline, "test"],
          },
          { error: "," },
          NestedField,
        ],
      },
      stream: [
        { "{": true },
        "hej",
        NestedFieldInline,
        "test",
        { "}": true },
        null as any,
        NestedField,
      ],
    },
  ]);

  tests.forEach(runTest);
});

describe("pick", () => {
  const tests = createTests([
    {
      tokens: [{ ...NestedField, pick: "abc" as RawFieldId }],
      syntax: {
        type: null,
        children: [
          {
            type: "pick",
            children: [NestedField],
            payload: {
              pick: "abc",
            },
          },
        ],
      },
      stream: [{ "(": true }, NestedField, { p: "abc" as RawFieldId }],
    },
  ]);

  tests.forEach(runTest);
});
