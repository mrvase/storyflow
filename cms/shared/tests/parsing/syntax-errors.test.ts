import { describe } from "vitest";
import {
  createEnvironment,
  NestedDocument,
  NestedDocumentInline,
} from "./computation-test";

describe("operator syntax errors", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      tokens: [{ _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [{ error: "missing" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, null as any, 2, { ")": "*" }],
      value: [2],
    },

    {
      tokens: [{ _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [{ error: "missing" }, { error: "missing" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, null as any, null as any, 2, { ")": "*" }],
      value: [2],
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
      value: [2],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { error: "missing" }],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, { ")": "*" }],
      value: [2],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { error: "missing" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, 2, { ")": "*" }],
      value: [2 * 2],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { error: "missing" }, { error: "missing" }, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, null as any, 2, { ")": "*" }],
      value: [2 * 2],
    },

    {
      tokens: [2, { _: "*" }, { _: "*" }, 2, { _: "*" }, 2],
      syntax: {
        type: null,
        children: [
          {
            type: "*",
            children: [2, { error: "missing" }, 2, 2],
          },
        ],
      },
      stream: [{ "(": true }, 2, null as any, 2, 2, { ")": "*" }],
      value: [2 * 2 * 2],
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
      value: [2 * 2],
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
      value: [2],
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
      value: [2 + 2],
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
      value: [2 + 2],
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
      value: [2],
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
      value: [2],
    },
  ]);
});
describe("bracket syntax errors", () => {
  const { createTests } = createEnvironment();

  createTests([
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
      stream: [{ "(": true }, 2],
      value: [2],
    },

    {
      tokens: [2, { ")": true }],
      syntax: {
        type: null,
        children: [2, { error: ")" }],
      },
      stream: [2, { ")": false }],
      value: [2],
    },

    {
      tokens: [2, { _: "*" }, 3, { ")": true }],
      syntax: {
        type: null,
        children: [{ type: "*", children: [2, 3] }, { error: ")" }],
      },
      stream: [{ "(": true }, 2, 3, { ")": "*" }, { ")": false }],
      value: [2 * 3],
    },
  ]);
});
describe("comma syntax errors", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      tokens: [{ ",": true }, 2],
      syntax: {
        type: null,
        children: [{ error: "," }, 2],
      },
      stream: [null as any, 2],
      value: [2],
    },

    {
      tokens: [{ ",": true }, { ",": true }, 2],
      syntax: {
        type: null,
        children: [{ error: "," }, { error: "," }, 2],
      },
      stream: [null as any, null as any, 2],
      value: [2],
    },

    {
      tokens: [2, { ",": true }],
      syntax: {
        type: null,
        children: [2, { error: "," }],
      },
      stream: [2, null as any],
      value: [2],
    },

    {
      tokens: [2, { ",": true }, { ",": true }],
      syntax: {
        type: null,
        children: [2, { error: "," }, { error: "," }],
      },
      stream: [2, null as any, null as any],
      value: [2],
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
      value: [2],
    },

    {
      tokens: [{ "(": true }, 2, { ",": true }, { ")": true }],
      syntax: {
        type: null,
        children: [{ type: null, children: [2, { error: "," }] }],
      },
      stream: [{ "(": true }, 2, null as any, { ")": true }],
      value: [2],
    },

    {
      tokens: ["Hej", { ",": true }, { n: true }],
      syntax: {
        type: null,
        children: ["Hej", { error: "," }, { n: true }],
      },
      stream: ["Hej", null as any, { n: true }],
      value: ["Hej"],
    },

    {
      tokens: [NestedDocument, { ",": true }, NestedDocument],
      syntax: {
        type: null,
        children: [NestedDocument, { error: "," }, NestedDocument],
      },
      stream: [NestedDocument, null as any, NestedDocument],
    },
  ]);
});
describe("comma / merge syntax errors", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      tokens: [
        "hej",
        NestedDocumentInline,
        "test",
        { ",": true },
        NestedDocument,
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: ["hej", NestedDocumentInline, "test"],
          },
          { error: "," },
          NestedDocument,
        ],
      },
      stream: [
        { "{": true },
        "hej",
        NestedDocumentInline,
        "test",
        { "}": true },
        null as any,
        NestedDocument,
      ],
    },
  ]);
});
