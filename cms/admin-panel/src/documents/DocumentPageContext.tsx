import React from "react";
import type { DocumentId } from "@storyflow/shared/types";
import type { SyntaxTreeRecord } from "@storyflow/fields-core/types";
import { DocumentVersionRecord } from "@storyflow/db-core/types";

export const DocumentPageContext = React.createContext<{
  id: DocumentId;
  record: SyntaxTreeRecord;
  versions: DocumentVersionRecord;
} | null>(null);

export const useDocumentPageContext = () => {
  const ctx = React.useContext(DocumentPageContext);
  if (!ctx) throw new Error("DocumentPageContext.Provider not found.");
  return ctx;
};
