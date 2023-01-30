import React from "react";
import { FieldId } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";

export const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = () => useContextWithError(FieldIdContext, "FieldId");
