import React from "react";
import { ComputationRecord, DBDocument } from "@storyflow/backend/types";

export const DocumentPageContext = React.createContext<{
  id: string;
  record: ComputationRecord;
} | null>(null);

export const useDocumentPageContext = () => {
  const ctx = React.useContext(DocumentPageContext);
  if (!ctx) throw new Error("DocumentPageContext.Provider not found.");
  return ctx;
};
