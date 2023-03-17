import { RawFieldId } from "@storyflow/backend/types2";
import { describe } from "vitest";
import { createEnvironment } from "./computation-test";

describe("pick", () => {
  const { createTests, createImport } = createEnvironment();
  const NestedField = createImport();
  const NestedFieldPick = { ...NestedField, select: "abc" };
  createTests([
    {
      tokens: [NestedFieldPick],
      syntax: {
        type: null,
        children: [
          {
            type: "select",
            children: [NestedField],
            payload: {
              select: "abc",
            },
          },
        ],
      },
      stream: [{ "(": true }, NestedField, { p: "abc" as RawFieldId }],
    },
  ]);
});
