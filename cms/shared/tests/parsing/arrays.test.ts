import { describe } from "vitest";
import { createEnvironment } from "./computation-test";

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
        type: null,
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
        type: null,
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
        type: null,
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
