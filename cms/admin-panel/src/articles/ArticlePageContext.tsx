import React from "react";
import { ComputationRecord, DBDocument } from "@storyflow/backend/types";

export const ArticlePageContext = React.createContext<{
  id: string;
  imports: ComputationRecord;
  article: DBDocument;
} | null>(null);

export const useArticlePageContext = () => {
  const ctx = React.useContext(ArticlePageContext);
  if (!ctx) throw new Error("ArticlePageContext.Provider not found.");
  return ctx;
};
