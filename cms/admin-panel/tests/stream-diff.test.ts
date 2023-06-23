import { describe, expect, it } from "vitest";
import { getComputationDiff } from "../src/fields/Editor/reconciler/getComputationDiff";

describe("Dates - handles quaters", () => {
  it("should not return actions without diff", () => {
    expect(getComputationDiff([], [])).toBe(null);
    expect(getComputationDiff(["abc"], ["abc"])).toBe(null);
    expect(getComputationDiff(["abc", 1, 2], ["abc", 1, 2])).toBe(null);
  });

  it("should return delete action on deletion", () => {
    expect(getComputationDiff(["a"], [])).toMatchObject([[0, 1]]);
    expect(getComputationDiff(["hej med dig"], ["hej dig"])).toMatchObject([
      [4, 4],
    ]);
  });

  it("should return delete action on deletion", () => {
    expect(
      getComputationDiff(
        [
          {
            "(": true,
          },
          "a",
          {
            ",": true,
          },
          "b",
          {
            ",": true,
          },
          {
            ",": true,
          },
          {
            "(": true,
          },
          {
            ",": true,
          },
          {
            in: true,
          },
          {
            if: true,
          },
        ],
        [
          {
            "(": true,
          },
          "a",
          {
            ",": true,
          },
          "b",
          {
            ",": true,
          },
          {
            "(": true,
          },
          {
            ",": true,
          },
          {
            in: true,
          },
          {
            if: true,
          },
        ]
      )
    ).toMatchObject([[5, 1]]);
  });
});
