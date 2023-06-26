import type {
  DBFolder,
  DBFolderRecord,
  FolderSpace,
  SpaceId,
} from "@storyflow/cms/types";
import { ROOT_FOLDER, TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import React from "react";
import { useCollaborativeState } from "../collab/useCollaborativeState";
import { getRawFolderId, normalizeFolderId } from "@storyflow/cms/ids";
import { isSpliceOperation, isToggleOperation } from "@storyflow/collab/utils";
import { FolderId, RawFolderId } from "@storyflow/shared/types";
import { QueueForEach } from "@storyflow/collab/Queue";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "../operations/actions";
import { createStaticStore } from "../state/StaticStore";
import { useTranslation } from "../translation/TranslationContext";
import { useImmutableQuery, useQuery } from "@nanorpc/client/swr";
import { query } from "../clients/client";

const folders = createStaticStore<DBFolder, Map<string, DBFolder>>(
  (old?) => new Map(old ?? [])
);

const createDefaultFolder = (_id: FolderId): DBFolder => ({
  _id,
  label: "",
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

export function FoldersProvider({ children }: { children: React.ReactNode }) {
  const { data: initialFoldersFromProps, error } = useImmutableQuery(
    query.admin.getFolders()
  );

  const t = useTranslation();

  const initialFolders: DBFolderRecord = React.useMemo(() => {
    return {
      [getRawFolderId(ROOT_FOLDER)]: {
        _id: ROOT_FOLDER,
        label: t.folders.home(),
        spaces: [
          {
            id: "00000000",
            type: "folders",
            items: [],
          },
        ],
      },
      [getRawFolderId(TEMPLATE_FOLDER)]: {
        _id: TEMPLATE_FOLDER,
        label: t.folders.templates(),
        spaces: [
          {
            id: "00000001",
            type: "documents",
          },
        ],
      },
      ...initialFoldersFromProps!.record,
    };
  }, [initialFoldersFromProps]);

  console.log("INITIAL FOLDERS", initialFolders);

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
              const spaceIndex = newFolder.spaces.findIndex(
                (el) => el.id === spaceId
              );
              const space = newFolder.spaces[spaceIndex] as FolderSpace;

              if (!space) return;

              const newSpace = {
                ...space,
                ...(space.type === "folders" && { items: [...space.items] }),
              };

              if (isSpliceOperation(operation)) {
                const [index, remove, insert] = operation;
                newSpace.items.splice(index, remove ?? 0, ...(insert ?? []));
              } else if (isToggleOperation(operation)) {
                newSpace[operation[0]] = operation[1];
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
  });

  return <>{children}</>;
}

export const useFolders = () => {
  return folders.useStore();
};

export const getFolder = (folderId: FolderId) => {
  return folders.get(folderId);
};

export const useFolder = (folderId: FolderId) => {
  return folders.useKey(folderId)[0] ?? createDefaultFolder(folderId);
};

export const useTemplateFolder = () => {
  return useFolder(TEMPLATE_FOLDER)!;
};
