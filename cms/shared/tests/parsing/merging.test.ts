import { describe } from "vitest";
import {
  createEnvironment,
  NestedDocument,
  NestedDocumentInline,
} from "./computation-test";

describe("auto-merging inline elements and not block elements", () => {
  const { createTests, createImport } = createEnvironment();

  const NestedField = createImport();

  createTests([
    {
      tokens: ["Hej", NestedField],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: ["Hej", NestedField],
          },
        ],
      },
      stream: [{ "{": true }, "Hej", NestedField, { "}": true }],
    },

    {
      tokens: ["Hej", NestedDocumentInline],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: ["Hej", NestedDocumentInline],
          },
        ],
      },
      stream: [{ "{": true }, "Hej", NestedDocumentInline, { "}": true }],
    },

    {
      tokens: ["Hej", NestedDocument],
      syntax: {
        type: null,
        children: ["Hej", NestedDocument],
      },
      stream: ["Hej", NestedDocument],
    },

    {
      tokens: ["Hej", { ",": true }, NestedDocumentInline],
      syntax: {
        type: null,
        children: ["Hej", NestedDocumentInline],
      },
      stream: ["Hej", NestedDocumentInline],
    },

    {
      tokens: ["Hej", { ",": true }, NestedDocumentInline, "."],
      syntax: {
        type: null,
        children: [
          "Hej",
          {
            type: "merge",
            children: [NestedDocumentInline, "."],
          },
        ],
      },
      stream: ["Hej", { "{": true }, NestedDocumentInline, ".", { "}": true }],
    },

    {
      tokens: ["Hej", { n: true }, NestedDocumentInline, "."],
      syntax: {
        type: null,
        children: [
          "Hej",
          { n: true },
          {
            type: "merge",
            children: [NestedDocumentInline, "."],
          },
        ],
      },
      stream: [
        "Hej",
        { n: true },
        { "{": true },
        NestedDocumentInline,
        ".",
        { "}": true },
      ],
    },

    {
      tokens: [
        NestedDocument,
        NestedDocument,
        { "(": true },
        2,
        { ",": true },
        3,
        { ")": "slug" },
        NestedDocument,
      ],
      syntax: {
        type: null,
        children: [
          NestedDocument,
          NestedDocument,
          {
            type: "slug",
            children: [2, 3],
          },
          NestedDocument,
        ],
      },
      stream: [
        NestedDocument,
        NestedDocument,
        { "(": true },
        2,
        3,
        { ")": "slug" },
        NestedDocument,
      ],
    },

    {
      tokens: [
        NestedDocumentInline,
        "Tester",
        { "(": true },
        2,
        { ",": true },
        3,
        { ")": "slug" },
        "Hmmm",
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: [
              NestedDocumentInline,
              "Tester",
              {
                type: "slug",
                children: [2, 3],
              },
              "Hmmm",
            ],
          },
        ],
      },
      stream: [
        { "{": true },
        NestedDocumentInline,
        "Tester",
        { "(": true },
        2,
        3,
        { ")": "slug" },
        "Hmmm",
        { "}": true },
      ],
    },

    {
      tokens: [
        NestedDocumentInline,
        "Tester",
        { "(": true },
        5,
        { _: "*" },
        2,
        { ")": true },
        "Hmmm",
      ],
      syntax: {
        type: null,
        children: [
          {
            type: "merge",
            children: [
              NestedDocumentInline,
              "Tester",
              {
                type: null,
                children: [
                  {
                    type: "*",
                    children: [5, 2],
                  },
                ],
              },
              "Hmmm",
            ],
          },
        ],
      },
      stream: [
        { "{": true },
        NestedDocumentInline,
        "Tester",
        { "(": true },
        { "(": true },
        5,
        2,
        { ")": "*" },
        { ")": true },
        "Hmmm",
        { "}": true },
      ],
    },
  ]);
});
