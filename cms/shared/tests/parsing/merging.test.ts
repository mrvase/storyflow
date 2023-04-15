import { describe } from "vitest";
import {
  createEnvironment,
  NestedDocument,
  NestedDocumentInline,
  root,
} from "./computation-test";

describe("auto-merging inline elements and not block elements", () => {
  const { createTests, createImport } = createEnvironment();

  const NestedField = createImport();

  createTests([
    {
      tokens: ["Hej", NestedField],
      syntax: {
        ...root,
        children: ["Hej", NestedField],
      },
      stream: ["Hej", NestedField],
    },

    {
      tokens: ["Hej", NestedDocumentInline],
      syntax: {
        ...root,
        children: [
          {
            type: "merge",
            children: ["Hej", NestedDocumentInline],
          },
        ],
      },
      stream: [{ "(": true }, "Hej", NestedDocumentInline, { merge: true }],
    },

    {
      tokens: ["Hej", NestedDocument],
      syntax: { ...root, children: ["Hej", NestedDocument] },
      stream: ["Hej", NestedDocument],
    },

    {
      tokens: ["Hej", { ",": true }, NestedDocumentInline],
      syntax: { ...root, children: ["Hej", NestedDocumentInline] },
      stream: ["Hej", NestedDocumentInline],
    },

    {
      tokens: ["Hej", { ",": true }, NestedDocumentInline, "."],
      syntax: {
        ...root,
        children: [
          "Hej",
          {
            type: "merge",
            children: [NestedDocumentInline, "."],
          },
        ],
      },
      stream: [
        "Hej",
        { "(": true },
        NestedDocumentInline,
        ".",
        { merge: true },
      ],
    },

    {
      tokens: ["Hej", { n: true }, NestedDocumentInline, "."],
      syntax: {
        ...root,
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
        { "(": true },
        NestedDocumentInline,
        ".",
        { merge: true },
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
        { slug: true },
        NestedDocument,
      ],
      syntax: {
        ...root,
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
        { slug: true },
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
        { slug: true },
        "Hmmm",
      ],
      syntax: {
        ...root,
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
        { "(": true },
        NestedDocumentInline,
        "Tester",
        { "(": true },
        2,
        3,
        { slug: true },
        "Hmmm",
        { merge: true },
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
        ...root,
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
        { "(": true },
        NestedDocumentInline,
        "Tester",
        { "(": true },
        { "(": true },
        5,
        2,
        { "*": true },
        { ")": true },
        "Hmmm",
        { merge: true },
      ],
    },
  ]);
});
