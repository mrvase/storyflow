import React from "react";
import { ComputationRecord, DBDocument } from "@storyflow/backend/types";

export const DocumentPageContext = React.createContext<{
  id: string;
  imports: ComputationRecord;
  article: DBDocument;
} | null>(null);

export const useDocumentPageContext = () => {
  const ctx = React.useContext(DocumentPageContext);
  if (!ctx) throw new Error("DocumentPageContext.Provider not found.");
  return ctx;
};
