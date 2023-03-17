import { describe } from "vitest";
import { createEnvironment } from "./computation-test";

describe("concat", () => {
  const { createTests } = createEnvironment();
  createTests([
    {
      tokens: [{ "(": true }, "a", { ",": true }, "b", { ")": "concat" }],
      syntax: {
        type: null,
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
