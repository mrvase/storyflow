import { describe, expect, it } from "vitest";
import { replacePlaceholders } from "../src/translation/placeholders";

describe("Translation", () => {
  it("Replaces placeholders", () => {
    const string = "My name is {{name}} and I am {{age}} years old";
    expect(replacePlaceholders(string, { name: "John", age: 25 })).toBe(
      "My name is John and I am 25 years old"
    );
  });

  it("should handle pluralization", () => {
    const string = "Here (is|are) {{count}} (apple|apples)";
    expect(replacePlaceholders(string, { count: 1 })).toBe("Here is 1 apple");
    expect(replacePlaceholders(string, { count: 2 })).toBe("Here are 2 apples");
  });

  it("should ignore empty pluralization", () => {
    const string = "Add(|)";
    expect(replacePlaceholders(string, {})).toBe("Add");
    expect(replacePlaceholders(string, { count: 1 })).toBe("Add");
    expect(replacePlaceholders(string, { count: 2 })).toBe("Add");
  });

  it("should handle custom modifiers", () => {
    const string = "I have {{count:numeral}} (apple|apples)";

    const modifiers = {
      numeral(value: number) {
        return { 1: "one", 2: "two" }[value] || value;
      },
    };

    expect(replacePlaceholders(string, { count: 1 }, modifiers)).toBe(
      "I have one apple"
    );
    expect(replacePlaceholders(string, { count: 2 }, modifiers)).toBe(
      "I have two apples"
    );
  });
});
