import { describe, expect, it } from "vitest";
import { parseDateFromString } from "../src/utils/dates";

describe("Dates - handles quaters", () => {
  it("kvart i", () => {
    const prompt = "kvart i tolv";
    const date = parseDateFromString(prompt);
    expect(date.getHours()).toBe(11);
    expect(date.getMinutes()).toBe(45);
  });
  it("kvart over", () => {
    const prompt = "kvart over tolv";
    const date = parseDateFromString(prompt);
    expect(date.getHours()).toBe(12);
    expect(date.getMinutes()).toBe(15);
  });
});
