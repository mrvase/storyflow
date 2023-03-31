import React from "react";
import { FieldId, RestrictTo } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";
import { RegularOptions } from "@storyflow/frontend/types";

export const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = (): FieldId =>
  useContextWithError(FieldIdContext, "FieldId");

export const FieldRestrictionsContext = React.createContext<RestrictTo | null>(
  null
);
export const useFieldRestriction = () =>
  React.useContext(FieldRestrictionsContext);

export const FieldOptionsContext = React.createContext<RegularOptions | null>(
  null
);
export const useFieldOptions = () => React.useContext(FieldOptionsContext);
