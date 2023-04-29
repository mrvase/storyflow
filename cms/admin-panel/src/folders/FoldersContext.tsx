import type { DBFolder } from "@storyflow/db-core/types";
import { TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import React from "react";
import { SWRClient } from "../client";
import { TimelineEntry } from "@storyflow/collab/types";
import { initializeTimeline } from "../collab/createCollaborativeState";
import { useCollab } from "../collab/CollabContext";

const FoldersContext = React.createContext<{
  folders: DBFolder[];
  timeline: TimelineEntry[];
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

const emptyTimeline = [] as TimelineEntry[];

export const FoldersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data: folders, error } = SWRClient.folders.get.useQuery(undefined, {
    // refreshInterval: 10000,
  });

  const { data: timeline } = SWRClient.collab.getTimeline.useQuery("folders", {
    immutable: true,
  });

  const ctx = React.useMemo(() => {
    if (!folders || !timeline) return null;
    return {
      folders,
      timeline,
      error,
    };
  }, [folders, timeline, error]);

  initializeTimeline("folders", {
    timeline: timeline ?? emptyTimeline,
    versions: { [""]: timeline && folders ? folders.length : 0 },
    initialData: null,
  });

  if (!ctx) return null;

  return (
    <FoldersContext.Provider value={ctx}>{children}</FoldersContext.Provider>
  );
};
