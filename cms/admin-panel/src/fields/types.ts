import type { FieldId } from "@storyflow/shared/types";
import { ServerPackage } from "@storyflow/state";
import { FieldOperation } from "operations/actions";

// was placed in RenderField but led to circular dependency
export type FieldProps = {
  id: FieldId;
  version: number;
  history: ServerPackage<FieldOperation>[];
};
