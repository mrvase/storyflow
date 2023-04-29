import React from "react";
import type { FolderId } from "@storyflow/shared/types";
import type { DBFolder, Space, SpaceId } from "@storyflow/db-core/types";
import { createStaticStore } from "../../state/StaticStore";
import { useInitialFolders } from "../FoldersContext";
import { createReactSubject } from "../../state/useSubject";
import { QueueListenerParam } from "@storyflow/collab/Queue";
import { useCollaborativeState } from "../../collab/createCollaborativeState";
import {
  FolderListTransactionEntry,
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions_new";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";

const useFoldersSubject = createReactSubject<DBFolder[]>();

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

export function useFolders() {
  const { folders: initialFolders, timeline } = useInitialFolders();

  const version = initialFolders.length;

  console.log("HERE", initialFolders, timeline);

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

export function useFolder(folderId: FolderId): DBFolder {
  const { timeline } = useInitialFolders();

  const initialFolder = useFolders().find((el) => el._id === folderId); // support newly added folders

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

export const useAppFolders = () => {
  const ctx = useFolders();
  return ctx.filter((el) => el.type === "app");
};
