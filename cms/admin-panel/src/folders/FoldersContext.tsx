import type {
  DBFolder,
  DBFolderRecord,
  FolderSpace,
  SpaceId,
} from "@storyflow/db-core/types";
import { ROOT_FOLDER, TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import React from "react";
import { SWRClient } from "../client";
import { useCollaborativeState } from "../collab/useCollaborativeState";
import { getRawFolderId, normalizeFolderId } from "@storyflow/fields-core/ids";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { FolderId, RawFolderId } from "@storyflow/shared/types";
import { QueueForEach } from "@storyflow/collab/Queue";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions_new";
import { createStaticStore } from "../state/StaticStore";
import { useCollab } from "../collab/CollabContext";

export const FoldersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const collab = useCollab();

  React.useLayoutEffect(() => {
    // prefetched
    collab.initializeTimeline("folders");
    // initialized immediately (no external data)
    collab.initializeTimeline("documents", { versions: null });
  }, [collab]);

  React.useLayoutEffect(() => {
    const timeline = collab.getTimeline("documents")!;
    timeline.registerStaleListener(() => {
      timeline.initialize(
        async () => [],
        { versions: null },
        { resetLocalState: true, keepListeners: true }
      );
    });
  }, [collab]);

  const { data: folders } = SWRClient.folders.get.useQuery(undefined, {
    onSuccess(data) {
      collab.initializeTimeline("folders", { versions: data.version });
    },
  });

  console.log("DATA", folders);

  if (!folders) return null;

  return (
    <FetchedFoldersProvider folders={folders.record} version={folders.version}>
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
  version,
  children,
}: {
  folders: DBFolderRecord;
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

  const operator = React.useCallback(
    (
      forEach: QueueForEach<FolderTransactionEntry | SpaceTransactionEntry>,
      origin: "initial" | "update"
    ) => {
      const updates: Record<FolderId, DBFolder> =
        origin === "initial"
          ? Object.fromEntries(
              Object.entries(initialFolders).map(([key, value]) => [
                normalizeFolderId(key as RawFolderId),
                { ...value, spaces: [...value.spaces] },
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
              console.log("UPDATED 2", folderId, newFolder);
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
              console.log("UPDATED 1", folderId, newFolder);
              updates[folderId] = newFolder;
            });
          }
        });
      });

      console.log("RUNNING", origin, updates);

      return new Map(Object.entries(updates));
    },
    [initialFolders]
  );

  useCollaborativeState(stateInitializer, operator, {
    timelineId: "folders",
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
