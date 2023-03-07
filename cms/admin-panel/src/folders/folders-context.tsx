import { DBFolder, DocumentId, FolderChild } from "@storyflow/backend/types";
import { createQueue, ServerPackage } from "@storyflow/state";
import React from "react";
import { SWRClient } from "../client";
import { pushAndRetry } from "../utils/retryOnError";

export type FolderMutation =
  | {
      type: "reorder";
      children: FolderChild[];
      insert?:
        | {
            id: string;
            label: string;
            type: "data";
          }
        | {
            id: string;
            label: string;
            type: "app";
            frontId: DocumentId;
          };
    }
  | { name: "label"; value: string }
  | { name: "domains"; value: string[] }
  | { name: "template"; value: string };

export type FolderOperation = {
  id: string;
  actions: FolderMutation[];
};

const queue = createQueue<FolderOperation>("folders", {
  clientId: null,
}).initialize(0, []);

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

export const pushFolderAndRetry = (
  id: string,
  operation: FolderOperation,
  mutate: any
) => pushAndRetry(id, operation, mutate, queue);
