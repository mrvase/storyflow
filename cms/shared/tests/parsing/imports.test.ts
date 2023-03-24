import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("nesting - arithmetics", () => {
  const { createTests, createImport } = createEnvironment();

  const NestedField1 = createImport({
    tokens: [5],
    syntax: { ...root, children: [5] },
    stream: [5],
    value: [5],
  });

  const NestedField2 = createImport({
    tokens: [2, { _: "*" }, NestedField1],
    syntax: { ...root, children: [{ type: "*", children: [2, NestedField1] }] },
    stream: [{ "(": true }, 2, NestedField1, { ")": "*" }],
    value: [2 * 5],
  });

  createImport({
    tokens: [2, { _: "*" }, NestedField2],
    syntax: { ...root, children: [{ type: "*", children: [2, NestedField2] }] },
    stream: [{ "(": true }, 2, NestedField2, { ")": "*" }],
    value: [2 * 2 * 5],
  });

  createTests([]);
});

describe("nesting - arrays", () => {
  const { createTests, createImport } = createEnvironment();

  const NestedFieldInline1 = createImport({
    tokens: [3, { ",": true }, 4, { ",": true }, 5],
    syntax: { ...root, children: [3, 4, 5] },
    stream: [3, 4, 5],
    value: [3, 4, 5],
    inline: true,
  });

  const NestedFieldInline2 = createImport({
    tokens: [
      3,
      { ",": true },
      { "[": true },
      4,
      { ",": true },
      5,
      { "]": true },
    ],
    syntax: { ...root, children: [3, { type: "array", children: [4, 5] }] },
    stream: [3, { "[": true }, 4, 5, { "]": true }],
    value: [3, [4, 5]],
    inline: true,
  });

  const NestedFieldInline3 = createImport({
    tokens: [
      { "[": true },
      4,
      { ",": true },
      5,
      { "]": true },
      { ",": true },
      6,
    ],
    syntax: { ...root, children: [{ type: "array", children: [4, 5] }, 6] },
    stream: [{ "[": true }, 4, 5, { "]": true }, 6],
    value: [[4, 5], 6],
    inline: true,
  });

  createTests([
    {
      tokens: [1, { ",": true }, 2, { ",": true }, NestedFieldInline1],
      syntax: { ...root, children: [1, 2, NestedFieldInline1] },
      stream: [1, 2, NestedFieldInline1],
      value: [1, 2, 3, 4, 5],
    },
    {
      tokens: [1, { ",": true }, 2, { ",": true }, NestedFieldInline2],
      syntax: { ...root, children: [1, 2, NestedFieldInline2] },
      stream: [1, 2, NestedFieldInline2],
      value: [1, 2, 3, [4, 5]],
    },
    {
      tokens: [
        { "[": true },
        1,
        { ",": true },
        2,
        { "]": true },
        { ",": true },
        3,
        { ",": true },
        NestedFieldInline3,
      ],
      syntax: {
        ...root,
        children: [{ type: "array", children: [1, 2] }, 3, NestedFieldInline3],
      },
      stream: [{ "[": true }, 1, 2, { "]": true }, 3, NestedFieldInline3],
      value: [[1, 2], 3, [4, 5], 6],
    },
  ]);
});
