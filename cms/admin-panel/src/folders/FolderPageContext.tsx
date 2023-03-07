import React from "react";
import { DBFolder } from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";

export const FolderContext = React.createContext<DBFolder | undefined | null>(
  null
);
export const useCurrentFolder = () =>
  useContextWithError(FolderContext, "Folder");
