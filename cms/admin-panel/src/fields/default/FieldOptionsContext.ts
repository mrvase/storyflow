import { RegularOptions } from "@storyflow/frontend/types";
import React from "react";

export const FieldOptionsContext = React.createContext<RegularOptions | null>(
  null
);

export const useFieldOptions = () => React.useContext(FieldOptionsContext);
