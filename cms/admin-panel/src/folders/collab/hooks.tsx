import React from "react";
import type { FolderId } from "@storyflow/shared/types";
import type {
  DBFolder,
  FolderSpace,
  Space,
  SpaceId,
} from "@storyflow/db-core/types";
import { createStaticStore } from "../../state/StaticStore";
// import { useInitialFolders } from "../FoldersContext";
import { QueueListenerParam } from "@storyflow/collab/Queue";
import { useCollaborativeState } from "../../collab/createCollaborativeState";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions_new";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { getRawFolderId } from "@storyflow/fields-core/ids";

/*
const folders = createStaticStore<DBFolder, Map<string, DBFolder>>(
  (old?) => new Map(old ?? [])
);

const spaces = createStaticStore<Space, Map<string, Space>>(() => new Map());

export const useFolderPaths = () => {
  const foldersStore = folders.useStore();
  const spacesStore = spaces.useStore();

  const parents = React.useMemo(() => {
    const map = new Map<string, string>();
    foldersStore.forEach((folder) => {
      folder.spaces?.forEach(({ id }) => {
        const space = spacesStore.get(id);
        if (space && "items" in space) {
          space.items.forEach((item) => {
            map.set(item, id);
          });
        }
      });
    });
    return map;
  }, [foldersStore, spacesStore]);

  return parents;
};

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

export function useFolders() {
  const { timeline, folders: initialFolders, version } = useInitialFolders();

  const operator = React.useCallback(
    ({
      forEach,
    }: QueueListenerParam<FolderTransactionEntry | SpaceTransactionEntry>) => {
      const updates: Record<FolderId, DBFolder> = {};

      forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          const [folderId, spaceId] = entry[0].split(":") as [
            FolderId,
            SpaceId | undefined
          ];
          if (spaceId) {
            (entry as SpaceTransactionEntry)[1].forEach((operation) => {
              const initial = initialFolders[getRawFolderId(folderId)] ?? {
                _id: folderId,
                type: "data",
                spaces: [],
              };
              const newFolder = updates[folderId] ?? {
                ...initial,
                spaces: [...initial.spaces],
              };
              const newSpace = newFolder.spaces.find(
                (el) => el.id === spaceId
              ) as FolderSpace;

              if (isSpliceOperation(operation)) {
                const [index, remove, insert] = operation;
                newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
              }
            });
          } else {
            (entry as FolderTransactionEntry)[1].forEach((operation) => {
              const initial = initialFolders[getRawFolderId(folderId)];
              const newFolder = updates[folderId] ?? {
                ...initial,
                spaces: [...initial.spaces],
              };
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

  const folders = useCollaborativeState(stateInitializer, operator, {
    timelineId: "folders",
    version,
    timeline,
  });
}
*/

/*
const useFoldersSubject = createReactSubject<DBFolder[]>();

export function useFolders() {
  const { folders: initialFolders, version, timeline } = useInitialFolders();

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<FolderListTransactionEntry>) => {
      let newArray = [...initialFolders];

      forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          entry[1].forEach((action) => {
            if (typeof action === "object" && !("add" in action)) {
              newArray.push(action as any);
            }
            if (action[0] === "add") {
              newArray.push(action[1]);
            }
          });
        });
      });
      console.log("FOR EACH FOLDERS", newArray);

      return newArray;
    },
    [initialFolders]
  );

  return useCollaborativeState(useFoldersSubject, operator, {
    version,
    timeline,
    timelineId: "folders",
    queueId: "",
  });
}
*/

/*
export function useFolder(folderId: FolderId): DBFolder {
  const { timeline, folders: initialFolders } = useInitialFolders();

  const initialFolder: DBFolder = initialFolders[getRawFolderId(folderId)] ?? {
    _id: folderId,
    label: "Ny mappe",
    spaces: [],
  }; // support newly added folders

  if (!initialFolder) {
    throw new Error("Folder not found");
  }

  const version = initialFolder.versions?.config ?? 0;

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<FolderTransactionEntry>) => {
      const newFolder = { ...initialFolder };
      newFolder.spaces = [...(newFolder.spaces ?? [])];

      forEach(({ transaction }) => {
        transaction.forEach((entry) => {
          if (entry[0] === "") {
            entry[1].forEach((operation) => {
              if (isSpliceOperation(operation)) {
                const [index, remove, insert] = operation;
                newFolder.spaces!.splice(index, remove ?? 0, ...(insert ?? []));
              } else if (isToggleOperation(operation)) {
                newFolder[operation[0] as "label"] = operation[1] as string;
              }
            });
          }
        });
      });
      console.log("FOR EACH FOLDER", newFolder);

      return newFolder;
    },
    [initialFolder]
  );

  return useCollaborativeState(
    (callback) => folders.useKey(folderId, callback),
    operator,
    {
      version,
      timeline,
      timelineId: "folders",
      queueId: folderId,
    }
  );
}

export function useSpace<T extends Space>({
  folderId,
  spaceId,
}: {
  folderId: FolderId;
  spaceId: SpaceId;
}): T {
  const { timeline } = useInitialFolders();

  const folder = useFolder(folderId);

  if (!folder) {
    throw new Error("Folder does not exist");
  }

  const initialSpace = folder.spaces?.find((el) => el.id === spaceId) as
    | T
    | undefined;

  if (!initialSpace) {
    throw new Error("Folder does not exist");
  }

  const version = folder?.versions?.[spaceId] ?? 0;

  console.log("SPACE", spaceId);

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<SpaceTransactionEntry>) => {
      const newSpace = { ...initialSpace };
      if ("items" in newSpace) {
        newSpace.items = [...newSpace.items];

        forEach(({ transaction }) => {
          console.log("TRANSACTION", transaction);
          transaction.forEach((entry) => {
            if (entry[0] === spaceId) {
              entry[1].forEach((operation) => {
                console.log("OPERATION", operation);
                if (isSpliceOperation(operation)) {
                  const [index, remove, insert] = operation;
                  newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
                }
              });
            }
          });
        });

        console.log("FOR EACH SPACE", newSpace);
      }
      return newSpace;
    },
    [initialSpace, spaceId]
  );

  return useCollaborativeState(
    (callback) => spaces.useKey(spaceId, callback),
    operator,
    {
      version,
      timeline,
      timelineId: "folders",
      queueId: folderId,
      target: spaceId,
    }
  );
}
*/
