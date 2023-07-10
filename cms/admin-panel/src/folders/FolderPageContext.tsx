import React from "react";
import type { DBFolder } from "@storyflow/cms/types";
import { useContextWithError } from "../utils/contextError";
import { isCustomFolder } from "@storyflow/cms/ids";

export const FolderContext = React.createContext<DBFolder | null>(null);
export const useCurrentFolder = () =>
  useContextWithError(FolderContext, "Folder");

export const useIsCustomFolder = () => {
  const folder = useCurrentFolder();
  return folder ? isCustomFolder(folder._id) : false;
};
