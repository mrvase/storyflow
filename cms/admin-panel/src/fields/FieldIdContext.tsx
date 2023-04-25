import React from "react";
import { FieldId } from "@storyflow/shared/types";
import { FieldType2 } from "@storyflow/fields-core/types";
import { useContextWithError } from "../utils/contextError";
import { RegularOptions } from "@storyflow/shared/types";

export const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = (): FieldId =>
  useContextWithError(FieldIdContext, "FieldId");

export const FieldRestrictionsContext = React.createContext<FieldType2 | null>(
  null
);
export const useFieldRestriction = () =>
  React.useContext(FieldRestrictionsContext);

export const FieldOptionsContext = React.createContext<RegularOptions | null>(
  null
);
export const useFieldOptions = () => React.useContext(FieldOptionsContext);
