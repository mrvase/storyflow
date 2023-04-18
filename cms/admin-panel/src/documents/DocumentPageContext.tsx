import React from "react";
import {
  DocumentId,
  RawFieldId,
  SyntaxTreeRecord,
} from "@storyflow/backend/types";

export const DocumentPageContext = React.createContext<{
  id: DocumentId;
  record: SyntaxTreeRecord;
  versions: Record<"config" | RawFieldId, number>;
} | null>(null);

export const useDocumentPageContext = () => {
  const ctx = React.useContext(DocumentPageContext);
  if (!ctx) throw new Error("DocumentPageContext.Provider not found.");
  return ctx;
};
