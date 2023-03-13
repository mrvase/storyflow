import React from "react";
import { DBFolder, Space } from "@storyflow/backend/types";
import { AddFolderOp, FolderOp, targetTools } from "shared/operations";
import { createStaticStore } from "../../state/StaticStore";
import { useInitialFolders } from "../folders-context";
import { createReactSubject } from "../../state/useSubject";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";
import { createCollaborativeState } from "./createCollaborativeState";

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
  const { folders: initialFolders, histories } = useInitialFolders();

  const version = initialFolders.length;
  const history = histories[""] ?? [];

  return createCollaborativeState(
    useFoldersSubject,
    ({ forEach }: QueueListenerParam<AddFolderOp>) => {
      let newArray = [...initialFolders];

      forEach(({ operation }) => {
        operation.ops.forEach((action) => {
          newArray.push(action);
        });
      });

      return newArray;
    },
    {
      version,
      history,
      document: "folders",
      key: "",
    }
  );
}

export function useFolder(id: string): DBFolder {
  const { histories } = useInitialFolders();

  const initialFolder = useFolders().find((el) => el.id === id); // support newly added folders

  if (!initialFolder) {
    throw new Error("Folder not found");
  }

  const version = initialFolder.versions?.[id] ?? 0;
  const history = histories[id] ?? [];

  return createCollaborativeState(
    (callback) => folders.useKey(id, callback),
    ({ forEach }: QueueListenerParam<FolderOp>) => {
      const newFolder = { ...initialFolder };
      newFolder.spaces = [...(newFolder.spaces ?? [])];

      forEach(({ operation }) => {
        if (targetTools.isOperation(operation, "folder-spaces")) {
          operation.ops.forEach((action) => {
            const { index, insert, remove } = action;
            newFolder.spaces!.splice(index, remove ?? 0, ...(insert ?? []));
          });
        } else if (targetTools.isOperation(operation, "property")) {
          operation.ops.forEach((action) => {
            newFolder[action.name as "label"] = action.value;
          });
        }
      });

      return newFolder;
    },
    {
      version,
      history,
      document: "folders",
      key: id,
    }
  );
}

export function useSpace<T extends Space>({
  folderId,
  spaceId,
}: {
  folderId: string;
  spaceId: string;
}): T {
  const { histories } = useInitialFolders();

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

  const key = `${folderId}/${spaceId}`;

  const history = histories?.[key] ?? [];
  const version = folder?.versions?.[spaceId] ?? 0;

  return createCollaborativeState(
    (callback) => spaces.useKey(key, callback),
    ({ forEach }: QueueListenerParam<FolderOp>) => {
      const newSpace = { ...initialSpace };
      if ("items" in newSpace) {
        newSpace.items = [...newSpace.items];

        forEach(({ operation }) => {
          if (targetTools.isOperation(operation, "space-items")) {
            operation.ops.forEach((action) => {
              const { index, insert, remove } = action;
              newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
            });
          }
        });
      }
      return newSpace;
    },
    {
      version,
      history,
      document: "folders",
      key,
    }
  );
}

export const useAppFolders = () => {
  const ctx = useFolders();
  return ctx.filter((el) => el.type === "app");
};
