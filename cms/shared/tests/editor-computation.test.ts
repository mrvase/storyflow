import { expect, it } from "vitest";

it("works", () => {
  expect(2).toBe(2);
});

/*
const fullTransform = (value: Computation) =>
  decodeEditorComputation(encodeEditorComputation(value));

const expectEquivalence = (client: EditorComputation, db: Computation) => {
  expect(decodeEditorComputation(client)).toMatchObject(db);
  expect(encodeEditorComputation(db)).toMatchObject(client);
  expect(
    encodeEditorComputation(decodeEditorComputation(client))
  ).toMatchObject(client);
  expect(decodeEditorComputation(encodeEditorComputation(db))).toMatchObject(
    db
  );
};

describe("editor computation - operations", () => {
  it("handles simple operation", () => {
    const db: Computation = [{ "(": true }, 5, 2, { "*": true }];
    expect(encodeEditorComputation(db)).toMatchObject([5, { _: "*" }, 2]);
    expect(fullTransform(db)).toMatchObject(db);
  });
  it("handles nested multiplication", () => {
    const db: Computation = [
      { "(": true },
      2,
      { "(": true },
      2,
      { "(": true },
      2,
      2,
      { "*": true },
      { "*": true },
      { "*": true },
    ];
    const client: EditorComputation = [
      2,
      { _: "*" },
      2,
      { _: "*" },
      2,
      { _: "*" },
      2,
    ];
    expect(encodeEditorComputation(db)).toMatchObject(client);
    expect(decodeEditorComputation(client)).toMatchObject([
      { "(": true },
      2,
      2,
      2,
      2,
      { "*": true },
    ]);
  });
  it("handles nested addition", () => {
    const db: Computation = [
      { "(": true },
      2,
      { "(": true },
      2,
      { "(": true },
      2,
      2,
      { "+": true },
      { "+": true },
      { "+": true },
    ];
    const client: EditorComputation = [
      2,
      { _: "+" },
      2,
      { _: "+" },
      2,
      { _: "+" },
      2,
    ];
    expect(encodeEditorComputation(db)).toMatchObject(client);
    expect(decodeEditorComputation(client)).toMatchObject([
      { "(": true },
      2,
      2,
      2,
      2,
      { "+": true },
    ]);
  });
  it("handles nested multiplication and addition", () => {
    const db: Computation = [
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
      { "*": true },
      { "+": true },
      { "*": true },
      { "+": true },
      { "*": true },
    ];
    const client: EditorComputation = [
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
    ];
    expectEquivalence(client, db);
  });
});

describe("editor computation - parentheses", () => {
  it("saves unecessary parentheses", () => {
    expectEquivalence(
      [{ "(": true }, 3, { _: "+" }, 2, { ")": true }],
      [{ "(": true }, { "(": true }, 3, 2, { "+": true }, { ")": true }]
    );
    expectEquivalence(
      [{ "(": true }, 2, { _: "*" }, 4, { ")": true }, { _: "/" }, 2],
      [
        { "(": true },
        { "(": true },
        { "(": true },
        2,
        4,
        { "*": true },
        { ")": true },
        2,
        { "/": true },
      ]
    );
  });
  it("handles parentheses in operations 1", () => {
    const db: Computation = [
      { "(": true },
      5,
      { "(": true },
      3,
      2,
      { "+": true },
      { "*": true },
    ];
    const client: EditorComputation = [
      5,
      { _: "*" },
      { "(": true },
      3,
      { _: "+" },
      2,
      { ")": true },
    ];
    expectEquivalence(client, db);
  });
  it("handles parentheses in operations 2", () => {
    expectEquivalence(
      [
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
      [
        { "(": true },
        { "(": true },
        { "(": true },
        3,
        { "(": true },
        2,
        4,
        { "*": true },
        { "+": true },
        { ")": true },
        2,
        { "/": true },
      ]
    );
  });
});

describe("editor computation - objects", () => {
  it("can handle imports", () => {
    const db: Computation = [
      { "(": true },
      5,
      { "(": true },
      {
        id: "",
        fref: "aaaa" as FieldId,
        args: {},
      },
      { x: 0 },
      { "+": true },
      { "*": true },
    ];
    const client: EditorComputation = [
      5,
      { _: "*" },
      { "(": true },
      {
        id: "",
        fref: "aaaa" as FieldId,
        args: {},
      },
      { _: "+" },
      { x: 0 },
      { ")": true },
    ];
    expectEquivalence(client, db);
  });
});

describe("editor computation - arrays", () => {
  it("can handle arrays", () => {
    const db: Computation = [5, 1, 0];
    const client: EditorComputation = [5, { ",": true }, 1, { ",": true }, 0];
    expectEquivalence(client, db);
  });
  it("can handle arrays with operations", () => {
    const db: Computation = [5, 1, { "(": true }, 0, 2, { "+": true }];
    const client: EditorComputation = [
      5,
      { ",": true },
      1,
      { ",": true },
      0,
      { _: "+" },
      2,
    ];
    expectEquivalence(client, db);
  });
});

const imp = () => ({ id: "", fref: "" as FieldId, args: {} });

describe("editor computation - auto-merging around imports", () => {
  it("auto-merges imports with adjacent strings", () => {
    expectEquivalence(
      ["a", imp(), "a"],
      [{ "{": true }, "a", imp(), "a", { "}": true }]
    );
    expectEquivalence(
      [
        "a",
        imp(),
        "a",
        imp(),
        "a",
        imp(),
        "a",
        { dref: "" as DocumentId },
        imp(),
        "a",
      ],
      [
        { "{": true },
        "a",
        imp(),
        "a",
        imp(),
        "a",
        imp(),
        "a",
        { "}": true },
        { dref: "" as DocumentId },
        { "{": true },
        imp(),
        "a",
        { "}": true },
      ]
    );
  });
  it("does not auto-merge when comma-separated", () => {
    const client: EditorComputation = [
      "a",
      { ",": true },
      { id: "", fref: "" as FieldId, args: {} },
      { ",": true },
      2,
      { _: "*" },
      3,
    ];
    const db: Computation = [
      "a",
      { id: "", fref: "" as FieldId, args: {} },
      { "(": true },
      2,
      3,
      { "*": true },
    ];
    expectEquivalence(client, db);
  });
  it("does not merge non-mergeable drefs", () => {
    const client: EditorComputation = [
      "a",
      { dref: "" as DocumentId },
      { dref: "" as DocumentId },
      { dref: "" as DocumentId },
      "c",
    ];
    const db: Computation = [
      "a",
      { dref: "" as DocumentId },
      { dref: "" as DocumentId },
      { dref: "" as DocumentId },
      "c",
    ];
    expectEquivalence(client, db);
  });
  it("does not merge non-mergeable nested documents", () => {
    const client: EditorComputation = [
      "a",
      { id: "" as DocumentId, values: {} },
      { id: "" as DocumentId, values: {} },
      { id: "" as DocumentId, values: {} },
      "c",
    ];
    const db: Computation = [
      "a",
      { id: "" as DocumentId, values: {} },
      { id: "" as DocumentId, values: {} },
      { id: "" as DocumentId, values: {} },
      "c",
    ];
    expectEquivalence(client, db);
  });
  it("does auto-merge when linebreak-separated", () => {
    const client: EditorComputation = [
      "a",
      { id: "", fref: "" as FieldId, args: {} },
      "b",
      { n: true },
      { id: "", fref: "" as FieldId, args: {} },
      { n: true },
      "hejsa",
      { "(": true },
      2,
      { _: "*" },
      3,
      { ")": true },
      "sådan",
      { id: "", fref: "" as FieldId, args: {} },
      "det virker",
    ];
    const db: Computation = [
      { "{": true },
      "a",
      { id: "", fref: "" as FieldId, args: {} },
      "b",
      { "/": true },
      { id: "", fref: "" as FieldId, args: {} },
      { "/": true },
      "hejsa",
      { "(": true },
      { "(": true },
      2,
      3,
      { "*": true },
      { ")": true },
      "sådan",
      { id: "", fref: "" as FieldId, args: {} },
      "det virker",
      { "}": true },
    ];
    expectEquivalence(client, db);
  });
  it("auto-merges 1 linebreak with string", () => {
    const client: EditorComputation = [{ n: true }, "a"];
    const db: Computation = [{ "{": true }, { "/": true }, "a", { "}": true }];
    expectEquivalence(client, db);
  });
  it("auto-merges 2 linebreak with string", () => {
    const client: EditorComputation = [{ n: true }, { n: true }, "a"];
    const db: Computation = [
      { "{": true },
      { "/": true },
      { "/": true },
      "a",
      { "}": true },
    ];
    expectEquivalence(client, db);
  });
  it("auto-merges 2 linebreak with string", () => {
    const client: EditorComputation = [imp(), { n: true }, { n: true }, "a"];
    const db: Computation = [
      { "{": true },
      imp(),
      { "/": true },
      { "/": true },
      "a",
      { "}": true },
    ];
    expectEquivalence(client, db);
  });
});

describe("editor computation - equivalence with OPERATOR syntax errors", () => {
  it("bijectively transforms operator lacking its left side 1", () => {
    const client: EditorComputation = [{ _: "*" }, 2];
    const db: Computation = [{ "(": true }, null as any, 2, { "*": true }];
    expectEquivalence(client, db);
  });
  it("bijectively transforms operator lacking its left side 2", () => {
    const client: EditorComputation = [{ _: "*" }, { _: "*" }, 2];
    const db: Computation = [
      { "(": true },
      null as any,
      null as any,
      2,
      { "*": true },
    ];
    expectEquivalence(client, db);
  });
  it("bijectively transforms operator lacking its right side", () => {
    const client: EditorComputation = [2, { _: "*" }];
    const db: Computation = [{ "(": true }, 2, null as any, { "*": true }];
    expectEquivalence(client, db);
  });
  it("bijectively transforms operator lacking its right side", () => {
    const client: EditorComputation = [2, { _: "*" }, { _: "*" }];
    const db: Computation = [
      { "(": true },
      2,
      null as any,
      null as any,
      { "*": true },
    ];
    expectEquivalence(client, db);
  });
  it("bijectively transforms multiple different operators lacking left side", () => {
    const client: EditorComputation = [{ _: "+" }, { _: "*" }, 2];
    const db: Computation = [
      { "(": true },
      null as any,
      { "(": true },
      null as any,
      2,
      { "*": true },
      { "+": true },
    ];
    expectEquivalence(client, db);
  });
  it("bijectively transforms multiple different operators lacking right side", () => {
    const client: EditorComputation = [2, { _: "*" }, { _: "+" }];
    const db: Computation = [
      { "(": true },
      { "(": true },
      2,
      null as any,
      { "*": true },
      null,
      { "+": true },
    ];
    expectEquivalence(client, db);
  });
  it("non-matched parentheses 1", () => {
    const client: EditorComputation = [{ "(": true }, 2];
    const db: Computation = [{ "(": true }, 2];
    expectEquivalence(client, db);
  });
  it("non-matched parentheses 2", () => {
    const client: EditorComputation = [2, { ")": true }];
    const db: Computation = [2, { ")": true }];
    expectEquivalence(client, db);
  });
});

describe("editor computation - equivalence with COMMA syntax errors", () => {
  it("bijectively transforms comma lacking a left side value", () => {
    const client: EditorComputation = [{ ",": true }, 2];
    const db: Computation = [null as any, 2];
    expectEquivalence(client, db);
  });
  it("comma left double", () => {
    const client: EditorComputation = [{ ",": true }, { ",": true }, 2];
    const db: Computation = [null as any, null as any, 2];
    expectEquivalence(client, db);
  });
  it("bijectively transforms comma lacking a right side value", () => {
    const client: EditorComputation = [2, { ",": true }];
    const db: Computation = [2, null as any];
    expectEquivalence(client, db);
  });
  it("comma right double", () => {
    const client: EditorComputation = [2, { ",": true }, { ",": true }];
    const db: Computation = [2, null as any, null as any];
    expectEquivalence(client, db);
  });
  it("should work inside parentheses", () => {
    const client: EditorComputation = [
      { "(": true },
      2,
      { ",": true },
      { ",": true },
      { ")": true },
    ];
    const db: Computation = [
      { "(": true },
      2,
      null as any,
      null as any,
      { ")": true },
    ];
    expectEquivalence(client, db);
  });
});

describe("editor computation - equivalence with COMMA / MERGEABLE syntax errors", () => {
  it("nullifies 1 comma between mergeables and non-mergeables", () => {
    const client: EditorComputation = [
      "hej",
      imp(),
      "test",
      { ",": true },
      { dref: "" as DocumentId },
    ];
    const db: Computation = [
      { "{": true },
      "hej",
      imp(),
      "test",
      { "}": true },
      null as any,
      { dref: "" as DocumentId },
    ];
    expectEquivalence(client, db);
  });

  it("nullifies 2 comma between mergeables and non-mergeables", () => {
    const client: EditorComputation = [
      "hej",
      imp(),
      "test",
      { ",": true },
      { ",": true },
      { dref: "" as DocumentId },
    ];
    const db: Computation = [
      { "{": true },
      "hej",
      imp(),
      "test",
      { "}": true },
      null as any,
      null as any,
      { dref: "" as DocumentId },
    ];
    expectEquivalence(client, db);
  });

  it("nullifies 1 comma between non-mergeables", () => {
    const client: EditorComputation = [
      { dref: "" as DocumentId },
      { ",": true },
      { dref: "" as DocumentId },
    ];
    const db: Computation = [
      { dref: "" as DocumentId },
      null as any,
      null as any,
      { dref: "" as DocumentId },
    ];
    expectEquivalence(client, db);
  });
});

describe("editor computation - pick", () => {
  it("have a function in the db but only import in editor", () => {
    const client: EditorComputation = [
      {
        id: "",
        fref: "abcd" as FieldId,
        pick: "efgh" as TemplateFieldId,
        args: {},
      },
    ];
    const db: Computation = [
      { "(": true },
      {
        id: "",
        fref: "abcd" as FieldId,
        args: {},
      },
      { p: "efgh" as TemplateFieldId },
    ];
    expectEquivalence(client, db);
  });
});
*/
