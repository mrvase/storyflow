import { FieldId } from "@storyflow/backend/types";
import { ServerPackage } from "@storyflow/state";
import { FieldOperation } from "shared/operations";

// was placed in RenderField but led to circular dependency
export type FieldProps = {
  id: FieldId;
  version: number;
  history: ServerPackage<FieldOperation>[];
};
