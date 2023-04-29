import cl from "clsx";
import { DropShadow, Sortable } from "@storyflow/dnd";
import type { FolderId } from "@storyflow/shared/types";
import type { SpaceId, FolderSpace } from "@storyflow/db-core/types";
import type { DragResultAction } from "@storyflow/dnd/types";
import { FolderItem } from "./Folder";
import { useFolders, useSpace } from "../collab/hooks";
import Space from "./Space";
import {
  EllipsisHorizontalIcon,
  FolderPlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { AddFolderDialog } from "../AddFolderDialog";
import { Menu } from "../../elements/Menu";
import { usePush } from "../../collab/CollabContext";
import { createTransaction } from "@storyflow/collab/utils";
import {
  FolderTransactionEntry,
  SpaceTransactionEntry,
} from "operations/actions_new";

export function FolderGridSpace({
  spaceId,
  folderId,
  hidden,
  index,
}: {
  spaceId: SpaceId;
  folderId: FolderId;
  hidden: boolean;
  index: number;
}) {
  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const push = usePush<FolderTransactionEntry>("folders", folderId);
  const handleDelete = () => {
    push(createTransaction((t) => t.target("").splice({ index, remove: 1 })));
  };

  return (
    <>
      <AddFolderDialog
        isOpen={dialogIsOpen === "add-folder"}
        close={() => setDialogIsOpen(null)}
        folderId={folderId}
        spaceId={spaceId}
      />
      <Space
        id={spaceId}
        label={"Undermapper"}
        buttons={
          <>
            <Space.Button
              icon={FolderPlusIcon}
              onClick={() => setDialogIsOpen("add-folder")}
            />
            <Menu as={Space.Button} icon={EllipsisHorizontalIcon} align="right">
              <Menu.Item
                label="Slet space"
                icon={TrashIcon}
                onClick={handleDelete}
              />
            </Menu>
          </>
        }
      >
        <FolderGrid spaceId={spaceId} folderId={folderId} hidden={hidden} />
      </Space>
    </>
  );
}

function FolderGrid({
  spaceId,
  folderId,
  hidden,
}: {
  spaceId: SpaceId;
  folderId: FolderId;
  hidden: boolean;
}) {
  const space = useSpace<FolderSpace>({
    folderId,
    spaceId,
  });

  const folders = useFolders();

  const push = usePush<SpaceTransactionEntry>("folders", folderId);

  const folderItems = space.items
    .filter(Boolean)
    .map((id) => (folders ?? []).find((folder) => folder._id === id)!);

  const onChange = React.useCallback(
    (actions: DragResultAction[]) => {
      const ops = actions.map((action) => {
        if (action.type === "add") {
          return {
            index: action.index,
            insert: [action.item._id],
          };
        } else {
          return {
            index: action.index,
            remove: 1,
          };
        }
      });
      push(createTransaction((t) => t.target(spaceId).splice(...ops)));
    },
    [push, folderId, spaceId]
  );

  return (
    <Sortable
      type="folders"
      id={`${folderId}/${space.id}`}
      canReceive={{
        link: () => "ignore",
        move: ({ type }) => {
          return type === "folders" ? "accept" : "ignore";
        },
      }}
      disabled={hidden}
      onChange={onChange}
    >
      <div
        className={cl(
          "grid grid-cols-1 @lg:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-2 pl-9 min-h-[1.5rem]"
        )}
      >
        {space.items.length === 0 && (
          <div className="absolute text-gray-400 text-sm">Ingen mapper</div>
        )}
        {folderItems.map((folder, index) => (
          <FolderItem folder={folder._id} index={index} key={folder._id} />
        ))}
        <DropShadow>
          {(item) => {
            return <FolderItem index={folders.length} folder={item} />;
          }}
        </DropShadow>
      </div>
    </Sortable>
  );
}
