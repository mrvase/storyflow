import cl from "clsx";
import { DropShadow, Sortable } from "@storyflow/dnd";
import { FolderId, FolderSpace, SpaceId } from "@storyflow/backend/types";
import { DragResultAction } from "@storyflow/dnd/types";
import { FolderItem } from "./Folder";
import { useFolders, useSpace } from "../collab/hooks";
import { useFolderCollab } from "../collab/FolderCollabContext";
import Space from "./Space";
import { FolderPlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import React from "react";
import { AddFolderDialog } from "../AddFolderDialog";
import { Splice, targetTools } from "shared/operations";

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
    collab.mutate("folders", `${folderId}`).push({
      target: targetTools.stringify({
        location: "",
        operation: "folder-spaces",
      }),
      ops: [
        {
          index,
          remove: 1,
        },
      ],
    });
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
        label={"Undermapper"}
        buttons={
          <>
            <Space.Button
              icon={FolderPlusIcon}
              onClick={() => setDialogIsOpen("add-folder")}
            />
            <Space.Button icon={XMarkIcon} onClick={handleDelete} />
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
      const ops: Splice<string>[] = actions.map((action) => {
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
      collab.mutate("folders", `${folderId}/${spaceId}`).push({
        target: targetTools.stringify({
          location: "",
          operation: "space-items",
        }),
        ops,
      });
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
      <div className={cl("flex flex-wrap gap-2 pl-9 min-h-[1rem]")}>
        {space.items.length === 0 && (
          <div className="absolute text-gray-500 font-light text-sm">
            Ingen mapper
          </div>
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
