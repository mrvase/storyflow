import { computeFieldId } from "@storyflow/backend/ids";
import { DocumentId, RawFieldId } from "@storyflow/backend/types";
import { describe } from "vitest";
import { createEnvironment, root } from "./computation-test";

describe("select", () => {
  const { createTests, createImport } = createEnvironment();
  const NestedField = createImport();
  const NestedFieldPick = { ...NestedField, select: "abc" };
  createTests([
    {
      tokens: [NestedFieldPick],
      syntax: {
        ...root,
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

describe("calculator pick function", () => {
  const list = [
    {
      id: "000000000000000000000001" as DocumentId,
      values: {
        ["000firstname" as RawFieldId]: ["Martin"],
        ["0000lastname" as RawFieldId]: ["Vase"],
        ["0description" as RawFieldId]: [
          "Martin Vase",
          "Martin Vase",
          "Martin Vase",
        ],
      },
    },
    {
      id: "000000000000000000000002" as DocumentId,
      values: {
        ["000firstname" as RawFieldId]: ["Peter"],
        ["0000lastname" as RawFieldId]: ["Hansen"],
        ["0description" as RawFieldId]: [
          "Peter Hansen",
          "Peter Hansen",
          "Peter Hansen",
        ],
      },
    },
    {
      id: "000000000000000000000003" as DocumentId,
      values: {
        ["000firstname" as RawFieldId]: ["Martin"],
        ["0000lastname" as RawFieldId]: ["Hansen"],
        ["0description" as RawFieldId]: [
          "Martin Hansen",
          "Martin Hansen",
          "Martin Hansen",
        ],
      },
    },
    {
      id: "000000000000000000000004" as DocumentId,
      values: {
        ["000firstname" as RawFieldId]: ["Peter"],
        ["0000lastname" as RawFieldId]: ["Vase"],
        ["0description" as RawFieldId]: [
          "Peter Vase",
          "Peter Vase",
          "Peter Vase",
        ],
      },
    },
  ];

  const { createTests, createImport } = createEnvironment();

  list.forEach(({ id, values }) => {
    Object.entries(values).map(([key, value]) => {
      // all fields of the nested documents
      createImport({
        id: computeFieldId(id, key as RawFieldId),
        tokens: value
          .map((el) => [el, { ",": true as true }])
          .flat(1)
          .slice(0, -1),
        syntax: {
          ...root,
          children: value,
        },
        stream: value,
        value,
      });
    });
  });

  const listTest = {
    tokens: list.map(({ id }) => ({ id })),
    syntax: { ...root, children: list.map(({ id }) => ({ id })) },
    stream: list.map(({ id }) => ({ id })),
    value: list.map(({ id }) => ({ id })),
  };

  const NestedListField = createImport({ ...listTest });

  createTests([
    {
      tokens: [
        {
          ...NestedListField,
          select: "000firstname" as RawFieldId,
        },
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "select",
            children: [NestedListField],
            data: {
              select: "000firstname",
            },
          },
        ],
      },
      stream: [
        { "(": true },
        NestedListField,
        { ")": "select", f: "000firstname" as RawFieldId },
      ],
      value: ["Martin", "Peter", "Martin", "Peter"],
    },
  ]);

  const NestedListField2 = createImport({ ...listTest });
  const NestedListField3 = createImport({ ...listTest });

  createTests([
    {
      tokens: [
        {
          ...NestedListField2,
          select: "000firstname" as RawFieldId,
        },
        { ",": true },
        {
          ...NestedListField3,
          select: "0000lastname" as RawFieldId,
        },
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "select",
            children: [NestedListField2],
            data: {
              select: "000firstname",
            },
          },
          {
            type: "select",
            children: [NestedListField3],
            data: {
              select: "0000lastname",
            },
          },
        ],
      },
      stream: [
        { "(": true },
        NestedListField2,
        { ")": "select", f: "000firstname" as RawFieldId },
        { "(": true },
        NestedListField3,
        { ")": "select", f: "0000lastname" as RawFieldId },
      ],
      value: [
        "Martin",
        "Peter",
        "Martin",
        "Peter",
        "Vase",
        "Hansen",
        "Hansen",
        "Vase",
      ],
    },
  ]);

  const NestedListField4 = createImport({ ...listTest });
  const NestedListField5 = createImport({ ...listTest });

  createTests([
    {
      tokens: [
        { "[": true },
        {
          ...NestedListField4,
          select: "000firstname" as RawFieldId,
        },
        { "]": true },
        { ",": true },
        { "[": true },
        {
          ...NestedListField5,
          select: "0000lastname" as RawFieldId,
        },
        { "]": true },
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "array",
            children: [
              {
                type: "select",
                children: [NestedListField4],
                data: {
                  select: "000firstname",
                },
              },
            ],
          },
          {
            type: "array",
            children: [
              {
                type: "select",
                children: [NestedListField5],
                data: {
                  select: "0000lastname",
                },
              },
            ],
          },
        ],
      },
      stream: [
        { "[": true },
        { "(": true },
        NestedListField4,
        { ")": "select", f: "000firstname" as RawFieldId },
        { "]": true },
        { "[": true },
        { "(": true },
        NestedListField5,
        { ")": "select", f: "0000lastname" as RawFieldId },
        { "]": true },
      ],
      value: [
        ["Martin", "Peter", "Martin", "Peter"],
        ["Vase", "Hansen", "Hansen", "Vase"],
      ],
    },
  ]);

  const NestedListField6 = createImport({ ...listTest });

  createTests([
    {
      tokens: [
        {
          ...NestedListField6,
          select: "0description" as RawFieldId,
        },
      ],
      syntax: {
        ...root,
        children: [
          {
            type: "select",
            children: [NestedListField6],
            data: {
              select: "0description",
            },
          },
        ],
      },
      stream: [
        { "(": true },
        NestedListField6,
        { ")": "select", f: "0description" as RawFieldId },
      ],
      value: [
        ["Martin Vase", "Martin Vase", "Martin Vase"],
        ["Peter Hansen", "Peter Hansen", "Peter Hansen"],
        ["Martin Hansen", "Martin Hansen", "Martin Hansen"],
        ["Peter Vase", "Peter Vase", "Peter Vase"],
      ],
    },
  ]);
});
