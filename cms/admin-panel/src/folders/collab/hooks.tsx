import React from "react";
import type { FolderId } from "@storyflow/shared/types";
import type { DBFolder, Space, SpaceId } from "@storyflow/db-core/types";
import { createStaticStore } from "../../state/StaticStore";
import { useInitialFolders } from "../FoldersContext";
import { createReactSubject } from "../../state/useSubject";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";
import { createCollaborativeState } from "../../state/createCollaborativeState";
import { useFolderCollab } from "./FolderCollabContext";
import {
  FolderListOperation,
  FolderOperation,
  SpaceOperation,
  isSpliceAction,
  isToggleAction,
} from "operations/actions";

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

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<FolderListOperation>) => {
      let newArray = [...initialFolders];

      forEach(({ operation }) => {
        operation[1].forEach((action) => {
          if (typeof action === "object" && !("add" in action)) {
            newArray.push(action as any);
          }
          if ("add" in action) {
            newArray.push(action.add);
          }
        });
      });

      return newArray;
    },
    [initialFolders]
  );

  const collab = useFolderCollab();
  return createCollaborativeState(collab, useFoldersSubject, operator, {
    version,
    history,
    document: "folders",
    key: "",
  });
}

export function useFolder(id: FolderId): DBFolder {
  const { histories } = useInitialFolders();

  const initialFolder = useFolders().find((el) => el._id === id); // support newly added folders

  if (!initialFolder) {
    throw new Error("Folder not found");
  }

  const version = initialFolder.versions?.config ?? 0;
  const history = histories[id] ?? [];

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<FolderOperation>) => {
      const newFolder = { ...initialFolder };
      newFolder.spaces = [...(newFolder.spaces ?? [])];

      forEach(({ operation }) => {
        operation[1].forEach((action) => {
          if (isSpliceAction(action)) {
            const { index, insert, remove } = action;
            newFolder.spaces!.splice(index, remove ?? 0, ...(insert ?? []));
          } else if (isToggleAction(action)) {
            newFolder[action.name as "label"] = action.value;
          }
        });
      });

      return newFolder;
    },
    [initialFolder]
  );

  const collab = useFolderCollab();
  return createCollaborativeState(
    collab,
    (callback) => folders.useKey(id, callback),
    operator,
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
  folderId: FolderId;
  spaceId: SpaceId;
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

  const operator = React.useCallback(
    ({ forEach }: QueueListenerParam<SpaceOperation>) => {
      const newSpace = { ...initialSpace };
      if ("items" in newSpace) {
        newSpace.items = [...newSpace.items];

        forEach(({ operation }) => {
          operation[1].forEach((action) => {
            if (isSpliceAction(action)) {
              const { index, insert, remove } = action;
              newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
            }
          });
        });
      }
      return newSpace;
    },
    [initialSpace]
  );

  const collab = useFolderCollab();
  return createCollaborativeState(
    collab,
    (callback) => spaces.useKey(key, callback),
    operator,
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
