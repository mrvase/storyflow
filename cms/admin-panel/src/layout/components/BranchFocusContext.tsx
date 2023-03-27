import React from "react";

export const BranchFocusContext = React.createContext<{
  isFocused: boolean;
  id: string;
}>({ isFocused: false, id: "" });

export function useBranchIsFocused(): { isFocused: boolean; id: string } {
  return React.useContext(BranchFocusContext);
}
