import { expect, it } from "vitest";
import {
  calculate as calculate_,
  StateGetter,
} from "@storyflow/fields-core/calculate-server";
import type {
  NestedDocumentId,
  FieldId,
  ValueArray,
} from "@storyflow/shared/types";
import type {
  SyntaxTree,
  WithSyntaxError,
  NestedField,
} from "@storyflow/fields-core/types";
import type { TokenStream } from "../../types";
import type { SyntaxStream } from "@storyflow/db-core/types";
import { parseTokenStream, createTokenStream } from "../../parse-token-stream";
import {
  createSyntaxStream,
  parseSyntaxStream,
} from "@storyflow/db-core/parse-syntax-stream";

export type Test = {
  description?: string;
  skip?: boolean;
  tokens: TokenStream;
  syntax: SyntaxTree;
  stream: SyntaxStream;
  value?: ValueArray;
};

export const root = {
  type: "root" as "root",
};

export const calculate = (
  syntax: SyntaxTree,
  imports: { id: FieldId; value: SyntaxTree }[] = []
) => {
  const getState: StateGetter = (id, options): any => {
    if (typeof id !== "string") {
      return undefined;
    }
    const found = imports.find((i) => i.id === id);
    if (!found) {
      return undefined;
    }
    return "tree" in options && options.tree
      ? found.value
      : calculate_(found.value, getState);
  };
  return calculate_(syntax, getState);
};

export const NestedDocument = {
  id: "" as NestedDocumentId,
};

export const NestedDocumentInline = {
  id: "" as NestedDocumentId,
  inline: true as true,
};

export const createEnvironment = () => {
  const importTests: Test[] = [];
  const imports: { id: FieldId; value: SyntaxTree<WithSyntaxError> }[] = [];

  const runTest = (test: Test, index: number) => {
    const func = test.skip ? it.skip : it;
    func(test.description ?? `Test ${index + 1}`, () => {
      // parseTokenStream
      expect(parseTokenStream(test.tokens)).toMatchObject(test.syntax);
      expect(test.syntax).toMatchObject(parseTokenStream(test.tokens));

      expect(createTokenStream(test.syntax)).toMatchObject(test.tokens);
      expect(test.tokens).toMatchObject(createTokenStream(test.syntax));

      // createSyntaxStream
      if ("stream" in test && test.stream) {
        expect(
          createSyntaxStream(test.syntax, (id) => id as any)
        ).toMatchObject(test.stream);
        expect(test.stream).toMatchObject(
          createSyntaxStream(test.syntax, (id) => id as any)
        );

        // parseSyntaxStream
        expect(parseSyntaxStream(test.stream)).toMatchObject(test.syntax);
        expect(test.syntax).toMatchObject(parseSyntaxStream(test.stream));
      }

      if ("value" in test && test.value) {
        expect(calculate(test.syntax, imports)).toMatchObject(test.value);
        expect(test.value).toMatchObject(calculate(test.syntax, imports));
      }
    });
  };

  const generateId = () => {
    const generate4b = () => {
      return Math.random().toString(36).substring(2, 10);
    };
    return `${generate4b()}${generate4b()}${generate4b()}`;
  };

  const createImport = (
    test?: Test & { id?: FieldId; inline?: boolean }
  ): NestedField => {
    const id = test?.id ?? (generateId() as FieldId);

    if (test) {
      const { inline: _, id: __, ...rest } = test;
      importTests.push(rest);
      const newImport = {
        id,
        value: test.syntax,
      };
      imports.push(newImport);
    }

    return {
      id: generateId() as NestedDocumentId,
      field: id,
      ...(test && test.inline ? { inline: true } : {}),
    };
  };

  const createTests = (tests: Test[]) => {
    importTests.forEach(runTest);
    tests.forEach(runTest);
  };

  return {
    createImport,
    createTests,
  };
};
