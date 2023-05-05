import React from "react";
import type { FieldId } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";

export const AppPageContext = React.createContext<{
  addDocumentWithUrl: (parent: Pick<DBDocument, "_id" | "record">) => void;
  urls: { id: FieldId; value: string; indent: number }[];
} | null>(null);

export const useAppPageContext = () => {
  const ctx = React.useContext(AppPageContext);
  if (!ctx) throw new Error("FolderPageContext.Provider not found.");
  return ctx;
};
