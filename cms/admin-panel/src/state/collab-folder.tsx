import React from "react";
import { useContextWithError } from "../utils/contextError";
import { useClient } from "../client";
import { createDocumentCollaboration } from "./collaboration";
import { ServerPackage } from "@storyflow/state";
import { DBFolder, Space } from "@storyflow/backend/types";
import { AddFolderOp, AnyOp, FolderOp, targetTools } from "shared/operations";
import { useSingular } from "./state";
import { createStaticStore } from "./StaticStore";
import { useInitialFolders } from "../folders/folders-context";
import { createReactSubject } from "./useSubject";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";

export const FolderCollabContext = React.createContext<ReturnType<
  typeof createDocumentCollaboration
> | null>(null);

export const useFolderCollab = () =>
  useContextWithError(FolderCollabContext, "Collab");

/*
rokere spaces: document: "folders", key: "folder-id", location: ""
indenfor space: "folders", key: "folder-id", location: "space-id"
*/

export function FolderCollabProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useClient();

  const collab = React.useMemo(() => {
    return createDocumentCollaboration(client.folders.sync.mutation, {
      duration: 20000,
    });
  }, [client]);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, []);

  return (
    <FolderCollabContext.Provider value={collab}>
      {children}
    </FolderCollabContext.Provider>
  );
}

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

function createCollaborativeState<T, Operation extends AnyOp>(
  stateInitializer: (initialState: () => T) => [T, (value: T) => void],
  operator: (params: QueueListenerParam<Operation>) => T,
  {
    document,
    key,
    version,
    history,
  }: {
    document: string;
    key: string;
    version: number;
    history: ServerPackage<Operation>[];
  }
) {
  const collab = useFolderCollab();

  const invalidVersion = React.useCallback(
    (currentVersion: number | null) => {
      return version !== currentVersion;
    },
    [version]
  );

  const queue = React.useMemo(() => {
    return collab
      .getOrAddQueue<Operation>(document, key, {
        transform: (pkgs) => pkgs,
      })
      .initialize(version, history);
  }, []);

  const singular = useSingular(`collab/${document}/${key}`);

  React.useEffect(() => {
    return queue.register((params) =>
      singular(() => {
        if (invalidVersion(params.version)) return;
        setState(operator(params));
      })
    );
  }, []);

  const [state, setState] = stateInitializer(() => {
    let result: T | null = null;
    queue.run((params) => {
      result = operator(params);
    });
    return result!;
  });

  return state;
}

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
