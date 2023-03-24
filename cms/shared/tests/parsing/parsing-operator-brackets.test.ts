import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("operators and brackets", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      tokens: [2, { _: "*" }, 2, { _: "*" }, 2, { _: "*" }, 2],
      syntax: { ...root, children: [{ type: "*", children: [2, 2, 2, 2] }] },
      stream: [{ "(": true }, 2, 2, 2, 2, { ")": "*" }],
      value: [2 * 2 * 2 * 2],
    },

    {
      tokens: [2, { _: "+" }, 2, { _: "+" }, 2, { _: "+" }, 2],
      syntax: { ...root, children: [{ type: "+", children: [2, 2, 2, 2] }] },
      stream: [{ "(": true }, 2, 2, 2, 2, { ")": "+" }],
      value: [2 + 2 + 2 + 2],
    },

    {
      tokens: [2, { _: "*" }, { "(": true }, 2, { _: "+" }, 2, { ")": true }],
      syntax: {
        ...root,
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
      value: [2 * (2 + 2)],
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
        ...root,
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
      value: [2 * (2 + 2 * (2 + 2 * 2))],
    },
  ]);
});

describe("brackets", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      description: "Save unecessary brackets",
      tokens: [{ "(": true }, 3, { _: "+" }, 2, { ")": true }],
      syntax: {
        ...root,
        children: [{ type: null, children: [{ type: "+", children: [3, 2] }] }],
      },
      stream: [{ "(": true }, { "(": true }, 3, 2, { ")": "+" }, { ")": true }],
      value: [3 + 2],
    },

    {
      description: "Operation in function",
      tokens: [{ "(": true }, 5, { _: "*" }, 2, { ")": "slug" }],
      syntax: {
        ...root,
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
      value: [`${5 * 2}`],
    },

    {
      description: "handles parentheses in operations 1",
      tokens: [5, { _: "*" }, { "(": true }, 3, { _: "+" }, 2, { ")": true }],
      syntax: {
        ...root,
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
      value: [5 * (3 + 2)],
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
        ...root,
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
      value: [(3 + 2 * 4) / 2],
    },
  ]);
});
