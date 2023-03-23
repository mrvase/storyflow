import { RawFieldId } from "@storyflow/backend/types";
import { describe } from "vitest";
import { createEnvironment } from "./computation-test";

describe("select", () => {
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
            data: {
              select: "abc",
            },
          },
        ],
      },
      stream: [
        { "(": true },
        NestedField,
        { ")": "select", f: "abc" as RawFieldId },
      ],
    },
  ]);
});
