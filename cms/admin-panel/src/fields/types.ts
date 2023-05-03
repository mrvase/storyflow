import type { FieldId } from "@storyflow/shared/types";

// was placed in RenderField but led to circular dependency
export type FieldProps = {
  id: FieldId;
};
