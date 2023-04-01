import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("arithmetics", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      tokens: [5, { _: "*" }, 2],
      syntax: { ...root, children: [{ type: "*", children: [5, 2] }] },
      stream: [{ "(": true }, 5, 2, { ")": "*" }],
      value: [5 * 2],
    },
    {
      tokens: [5, { _: "+" }, 2],
      syntax: { ...root, children: [{ type: "+", children: [5, 2] }] },
      stream: [{ "(": true }, 5, 2, { ")": "+" }],
      value: [5 + 2],
    },
    {
      tokens: [5, { _: "/" }, 2],
      syntax: { ...root, children: [{ type: "/", children: [5, 2] }] },
      stream: [{ "(": true }, 5, 2, { ")": "/" }],
      value: [5 / 2],
    },
    {
      tokens: [5, { _: "-" }, 2],
      syntax: { ...root, children: [{ type: "-", children: [5, 2] }] },
      stream: [{ "(": true }, 5, 2, { ")": "-" }],
      value: [5 - 2],
    },
  ]);
});

describe("logic", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      tokens: [true, { _: "&" }, true],
      syntax: { ...root, children: [{ type: "&", children: [true, true] }] },
      stream: [{ "(": true }, true, true, { ")": "&" }],
      value: [true],
    },
    {
      tokens: [true, { _: "&" }, false],
      syntax: { ...root, children: [{ type: "&", children: [true, false] }] },
      stream: [{ "(": true }, true, false, { ")": "&" }],
      value: [false],
    },
    {
      tokens: [true, { _: "|" }, false],
      syntax: { ...root, children: [{ type: "|", children: [true, false] }] },
      stream: [{ "(": true }, true, false, { ")": "|" }],
      value: [true],
    },
    {
      tokens: [false, { _: "|" }, false],
      syntax: { ...root, children: [{ type: "|", children: [false, false] }] },
      stream: [{ "(": true }, false, false, { ")": "|" }],
      value: [false],
    },
    {
      tokens: [1, { _: "=" }, 1],
      syntax: { ...root, children: [{ type: "=", children: [1, 1] }] },
      stream: [{ "(": true }, 1, 1, { ")": "=" }],
      value: [true],
    },
    {
      tokens: [1, { _: "=" }, 2],
      syntax: { ...root, children: [{ type: "=", children: [1, 2] }] },
      stream: [{ "(": true }, 1, 2, { ")": "=" }],
      value: [false],
    },
  ]);
});

describe("brackets", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      tokens: [true, { _: "|" }, true, { _: "&" }, false],
      syntax: {
        ...root,
        children: [
          {
            type: "|",
            children: [true, { type: "&", children: [true, false] }],
          },
        ],
      },
      stream: [
        { "(": true },
        true,
        { "(": true },
        true,
        false,
        { ")": "&" },
        { ")": "|" },
      ],
      value: [true],
    },
    {
      tokens: [
        { "(": true },
        true,
        { _: "|" },
        true,
        { ")": true },
        { _: "&" },
        false,
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "&",
            children: [
              {
                type: null,
                children: [
                  {
                    type: "|",
                    children: [true, true],
                  },
                ],
              },
              false,
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "(": true },
        { "(": true },
        true,
        true,
        { ")": "|" },
        { ")": true },
        false,
        { ")": "&" },
      ],
      value: [false],
    },
  ]);
});

/*
describe("functions - merge", () => {});

describe("functions - in", () => {});

describe("functions - filter", () => {});
*/
