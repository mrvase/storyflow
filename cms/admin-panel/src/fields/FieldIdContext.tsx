import React from "react";
import type { FieldId } from "@storyflow/shared/types";
import type { FieldType2 } from "@storyflow/cms/types";
import { useContextWithError } from "../utils/contextError";
import type { Option } from "@storyflow/shared/types";

export const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = (): FieldId =>
  useContextWithError(FieldIdContext, "FieldId");
export const useFieldIdUnsafe = () => React.useContext(FieldIdContext);

export const FieldRestrictionsContext = React.createContext<FieldType2 | null>(
  null
);
export const useFieldRestriction = () =>
  React.useContext(FieldRestrictionsContext);

export const FieldOptionsContext = React.createContext<Option[] | null>(null);
export const useFieldOptions = () => React.useContext(FieldOptionsContext);
