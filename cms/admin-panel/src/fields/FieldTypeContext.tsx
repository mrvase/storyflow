import React from "react";
import { RestrictTo } from "@storyflow/backend/types";

export const FieldRestrictionsContext = React.createContext<RestrictTo | null>(
  null
);

export const useFieldRestriction = () =>
  React.useContext(FieldRestrictionsContext);
