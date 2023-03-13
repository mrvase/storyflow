import { DBFolder } from "@storyflow/backend/types";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";
import { ServerPackage } from "@storyflow/state";
import React from "react";
import { SWRClient } from "../client";

const FoldersContext = React.createContext<{
  folders: DBFolder[];
  histories: Record<string, ServerPackage<any>[]>;
  error: { message: string; error?: any } | undefined;
} | null>(null);

export const useInitialFolders = () => {
  const ctx = React.useContext(FoldersContext);
  if (!ctx) throw new Error("Found no FoldersProvider");
  return ctx;
};

export const useTemplateFolder = () => {
  const ctx = useInitialFolders();
  return ctx.folders.find((el) => el._id === TEMPLATE_FOLDER)!;
};

export const FoldersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data, error } = SWRClient.folders.get.useQuery(undefined, {
    // refreshInterval: 10000,
  });

  const ctx = React.useMemo(() => {
    if (!data) return null;
    return {
      folders: data.folders,
      histories: data.histories,
      error,
    };
  }, [data, error]);

  if (!ctx) return null;

  return (
    <FoldersContext.Provider value={ctx}>{children}</FoldersContext.Provider>
  );
};
