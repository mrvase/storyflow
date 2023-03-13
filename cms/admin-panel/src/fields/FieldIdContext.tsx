import React from "react";
import { FieldId } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";

export const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = (): FieldId =>
  useContextWithError(FieldIdContext, "FieldId");
