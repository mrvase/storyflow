import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("concat", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      tokens: [{ "(": true }, "a", { ",": true }, "b", { ")": "concat" }],
      syntax: {
        ...root,
        children: [
          {
            type: "concat",
            children: ["a", "b"],
          },
        ],
      },
      stream: [{ "(": true }, "a", "b", { ")": "concat" }],
      value: ["ab"],
    },
  ]);
});
