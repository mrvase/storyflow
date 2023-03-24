import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("nested arrays", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      tokens: [{ "[": true }, 2, { ",": true }, 3, { "]": true }],
      syntax: {
        ...root,
        children: [
          {
            type: "array",
            children: [2, 3],
          },
        ],
      },
      stream: [{ "[": true }, 2, 3, { "]": true }],
      value: [[2, 3]],
    },
    {
      tokens: [
        1,
        { ",": true },
        { "[": true },
        2,
        { ",": true },
        3,
        { "]": true },
        { ",": true },
        4,
      ],
      syntax: {
        ...root,
        children: [
          1,
          {
            type: "array",
            children: [2, 3],
          },
          4,
        ],
      },
      stream: [1, { "[": true }, 2, 3, { "]": true }, 4],
      value: [1, [2, 3], 4],
    },
    {
      tokens: [
        1,
        { ",": true },
        { "[": true },
        2,
        { ",": true },
        { "[": true },
        3,
        { ",": true },
        { "[": true },
        4,
        { ",": true },
        5,
        { "]": true },
        { "]": true },
        { ",": true },
        6,
        { "]": true },
      ],
      syntax: {
        ...root,
        children: [
          1,
          {
            type: "array",
            children: [
              2,
              {
                type: "array",
                children: [
                  3,
                  {
                    type: "array",
                    children: [4, 5],
                  },
                ],
              },
              6,
            ],
          },
        ],
      },
      stream: [
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
      ],
      value: [1, [2, [3, [4, 5]], 6]],
    },
  ]);
});

describe("operations on arrays", () => {
  const { createTests } = createEnvironment();

  createTests([
    {
      description: "multiply with number",
      tokens: [
        { "[": true },
        2,
        { ",": true },
        3,
        { "]": true },
        { _: "*" },
        2,
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "*",
            children: [
              {
                type: "array",
                children: [2, 3],
              },
              2,
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "[": true },
        2,
        3,
        { "]": true },
        2,
        { ")": "*" },
      ],
      value: [4, 6],
    },

    {
      description: "multiply with two numbers",
      tokens: [
        { "[": true },
        2,
        { ",": true },
        3,
        { "]": true },
        { _: "*" },
        2,
        { _: "*" },
        3,
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "*",
            children: [
              {
                type: "array",
                children: [2, 3],
              },
              2,
              3,
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "[": true },
        2,
        3,
        { "]": true },
        2,
        3,
        { ")": "*" },
      ],
      value: [12, 18],
    },
    {
      description: "multiply with array",
      tokens: [
        { "[": true },
        2,
        { ",": true },
        3,
        { "]": true },
        { _: "*" },
        { "[": true },
        2,
        { ",": true },
        3,
        { "]": true },
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "*",
            children: [
              {
                type: "array",
                children: [2, 3],
              },
              {
                type: "array",
                children: [2, 3],
              },
            ],
          },
        ],
      },
      stream: [
        { "(": true },
        { "[": true },
        2,
        3,
        { "]": true },
        { "[": true },
        2,
        3,
        { "]": true },
        { ")": "*" },
      ],
      value: [4, 6, 6, 9],
    },
  ]);
});
