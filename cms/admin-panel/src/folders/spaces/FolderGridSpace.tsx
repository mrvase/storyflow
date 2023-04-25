import cl from "clsx";
import { DropShadow, Sortable } from "@storyflow/dnd";
import { FolderId } from "@storyflow/shared/types";
import { SpaceId, FolderSpace } from "@storyflow/db-core/types";
import { DragResultAction } from "@storyflow/dnd/types";
import { FolderItem } from "./Folder";
import { useFolders, useSpace } from "../collab/hooks";
import { useFolderCollab } from "../collab/FolderCollabContext";
import Space from "./Space";
import {
  EllipsisHorizontalIcon,
  FolderPlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { AddFolderDialog } from "../AddFolderDialog";
import { Menu } from "../../layout/components/Menu";
import { SpaceItemsAction } from "operations/actions";

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

  const collab = useFolderCollab();
  const handleDelete = () => {
    collab.mutate("folders", folderId).push([
      "",
      [
        {
          index,
          remove: 1,
        },
      ],
    ]);
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

  const collab = useFolderCollab();

  const folderItems = space.items
    .filter(Boolean)
    .map((id) => (folders ?? []).find((folder) => folder._id === id)!);

  console.log("FOLDERS", folders, space.items, folderItems);

  const onChange = React.useCallback(
    (actions: DragResultAction[]) => {
      const ops: SpaceItemsAction[] = actions.map((action) => {
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
      collab.mutate("folders", `${folderId}/${spaceId}`).push(["", ops]);
    },
    [collab, folderId, spaceId]
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
