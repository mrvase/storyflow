import { Computation, FieldType, FunctionName } from "@storyflow/backend/types";

const fieldConfig: Record<
  FieldType,
  { initialValue: Computation; transform?: FunctionName }
> = {
  default: {
    initialValue: [],
  },
  url: {
    initialValue: [{ "(": true }, "", "", { ")": "url" }],
    transform: "url",
  },
  slug: {
    initialValue: [{ "(": true }, { ")": "slug" }],
    transform: "slug",
  },
};

export const getConfig = <T extends keyof typeof fieldConfig>(
  key: T
): (typeof fieldConfig)[T] => {
  return fieldConfig[key];
};
