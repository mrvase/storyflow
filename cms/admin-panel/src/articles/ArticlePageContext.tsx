import React from "react";
import { ComputationRecord } from "@storyflow/backend/types";

export const ArticlePageContext = React.createContext<{
  id: string;
  imports: ComputationRecord;
} | null>(null);

export const useArticlePageContext = () => {
  const ctx = React.useContext(ArticlePageContext);
  if (!ctx) throw new Error("ArticlePageContext.Provider not found.");
  return ctx;
};
