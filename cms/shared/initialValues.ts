import { FieldType, SyntaxTree } from "@storyflow/backend/types";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";

const fieldConfig: Record<FieldType, { initialValue: SyntaxTree }> = {
  default: {
    initialValue: DEFAULT_SYNTAX_TREE,
  },
  url: {
    initialValue: {
      type: "url",
      children: ["", ""],
    },
  },
  slug: {
    initialValue: {
      type: "slug",
      children: [],
    },
  },
  fetch: {
    initialValue: {
      type: "sortlimit",
      children: [],
      payload: {
        limit: 10,
      },
    },
  },
};

export const getConfig = <T extends keyof typeof fieldConfig>(
  key: T
): (typeof fieldConfig)[T] => {
  return fieldConfig[key];
};
