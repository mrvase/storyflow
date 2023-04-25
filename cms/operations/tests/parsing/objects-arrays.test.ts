import { describe } from "vitest";
import { createEnvironment, NestedDocument, root } from "./computation-test";

describe("editor computation - objects and arrays", () => {
  const { createTests } = createEnvironment();
  const tests = createTests([
    {
      description: "can handle objects",
      tokens: [
        5,
        { _: "*" },
        { "(": true },
        NestedDocument,
        { _: "+" },
        { x: 0 },
        { ")": true },
      ],
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
                    children: [NestedDocument, { x: 0 }],
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
        NestedDocument,
        { x: 0 },
        { "+": true },
        { "*": true },
      ],
      value: [5],
    },

    {
      description: "can handle arrays",
      tokens: [5, { ",": true }, 1, { ",": true }, 0],
      syntax: { ...root, children: [5, 1, 0] },
      stream: [5, 1, 0],
      value: [5, 1, 0],
    },
  ]);
});
