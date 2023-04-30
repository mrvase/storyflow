import type {
  DBFolder,
  DBFolderRecord,
  FolderSpace,
  SpaceId,
} from "@storyflow/db-core/types";
import { ROOT_FOLDER, TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import React from "react";
import { SWRClient } from "../client";
import { TimelineEntry } from "@storyflow/collab/types";
import {
  initializeTimeline,
  useCollaborativeState,
} from "../collab/createCollaborativeState";
import { getRawFolderId, normalizeFolderId } from "@storyflow/fields-core/ids";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { FolderId, RawFolderId } from "@storyflow/shared/types";
import { QueueListenerParam } from "@storyflow/collab/Queue";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions_new";
import { createStaticStore } from "../state/StaticStore";

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

  if (!folders || !timeline) return null;

  return (
    <FetchedFoldersProvider
      folders={folders.record}
      timeline={timeline}
      version={folders.version}
    >
      {children}
    </FetchedFoldersProvider>
  );
};

const folders = createStaticStore<DBFolder, Map<string, DBFolder>>(
  (old?) => new Map(old ?? [])
);

const createDefaultFolder = (_id: FolderId): DBFolder => ({
  _id,
  label: "",
  type: "data",
  spaces: [],
});

const stateInitializer = (callback: () => Map<string, DBFolder>) => {
  const store = folders.useStore(callback);

  const setStore = React.useCallback((updates: Map<string, DBFolder>) => {
    updates.forEach((value, key) => {
      // creates new map copy inside store automatically in order to trigger re-render
      folders.set(key, value);
    });
  }, []);

  return [store, setStore] as [typeof store, typeof setStore];
};

export function FetchedFoldersProvider({
  folders: initialFoldersFromProps,
  timeline,
  version,
  children,
}: {
  folders: DBFolderRecord;
  timeline: TimelineEntry[];
  version: number;
  children: React.ReactNode;
}) {
  const initialFolders: DBFolderRecord = React.useMemo(() => {
    return {
      [getRawFolderId(ROOT_FOLDER)]: {
        _id: ROOT_FOLDER,
        type: "data",
        label: "Hjem",
        spaces: [],
      },
      [getRawFolderId(TEMPLATE_FOLDER)]: {
        _id: TEMPLATE_FOLDER,
        type: "data",
        label: "Skabeloner",
        spaces: [],
      },
      ...initialFoldersFromProps,
    };
  }, [initialFoldersFromProps]);

  initializeTimeline("folders", {
    timeline: timeline ?? emptyTimeline,
    versions: version,
    initialData: null,
  });

  const operator = React.useCallback(
    (
      {
        forEach,
      }: QueueListenerParam<FolderTransactionEntry | SpaceTransactionEntry>,
      origin: "initial" | "update"
    ) => {
      const updates: Record<FolderId, DBFolder> =
        origin === "initial"
          ? Object.fromEntries(
              Object.entries(initialFolders).map(([key, value]) => [
                normalizeFolderId(key as RawFolderId),
                value,
              ])
            )
          : {};

      const getInitialFolder = (folderId: FolderId) => {
        const initialFolder =
          initialFolders[getRawFolderId(folderId)] ??
          createDefaultFolder(folderId);
        return (
          updates[folderId] ?? {
            ...initialFolder,
            spaces: [...initialFolder.spaces],
          }
        );
      };

      forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          const [folderId, spaceId] = entry[0].split(":") as [
            FolderId,
            SpaceId | undefined
          ];

          if (spaceId) {
            (entry as SpaceTransactionEntry)[1].forEach((operation) => {
              const newFolder = getInitialFolder(folderId);
              const spaceIndex = newFolder.spaces.findIndex(
                (el) => el.id === spaceId
              );
              const space = newFolder.spaces[spaceIndex] as FolderSpace;
              const newSpace = {
                ...space,
                items: [...space.items],
              };

              if (isSpliceOperation(operation)) {
                const [index, remove, insert] = operation;
                newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
              }
              newFolder.spaces[spaceIndex] = newSpace;
              updates[folderId] = newFolder;
            });
          } else {
            (entry as FolderTransactionEntry)[1].forEach((operation) => {
              const newFolder = getInitialFolder(folderId);
              if (isSpliceOperation(operation)) {
                const [index, remove, insert] = operation;
                newFolder.spaces!.splice(index, remove ?? 0, ...(insert ?? []));
              } else if (isToggleOperation(operation)) {
                newFolder[operation[0] as "label"] = operation[1] as string;
              }
              updates[folderId] = newFolder;
            });
          }
        });
      });

      return new Map(Object.entries(updates));
    },
    [initialFolders]
  );

  useCollaborativeState(stateInitializer, operator, {
    timelineId: "folders",
    version,
    timeline,
  });

  return <>{children}</>;
}

export const useFolders = () => {
  return folders.useStore();
};

export const useFolder = (folderId: FolderId) => {
  return folders.useKey(folderId)[0] ?? createDefaultFolder(folderId);
};

export const useTemplateFolder = () => {
  return useFolder(TEMPLATE_FOLDER)!;
};
