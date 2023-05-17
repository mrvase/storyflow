import cl from "clsx";
import { DropShadow, Sortable } from "@storyflow/dnd";
import type { FolderId } from "@storyflow/shared/types";
import type { FolderSpace } from "@storyflow/cms/types";
import type { DragResultAction } from "@storyflow/dnd/types";
import { FolderItem } from "./Folder";
import Space from "./Space";
import {
  EllipsisHorizontalIcon,
  FolderPlusIcon,
  PlusIcon,
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
} from "../../operations/actions";
import { useTranslation } from "../../translation/TranslationContext";

export function FoldersSpace({
  space,
  folderId,
  hidden,
  index,
}: {
  space: FolderSpace;
  folderId: FolderId;
  hidden: boolean;
  index: number;
}) {
  const t = useTranslation();

  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const push = usePush<FolderTransactionEntry>("folders");
  const handleDeleteSpace = () => {
    push(
      createTransaction((t) => t.target(folderId).splice({ index, remove: 1 }))
    );
  };

  return (
    <>
      <AddFolderDialog
        isOpen={dialogIsOpen === "add-folder"}
        close={() => setDialogIsOpen(null)}
        folderId={folderId}
        spaceId={space.id}
      />
      <Space
        space={space}
        index={index}
        label={
          <>
            Mapper
            <AddFolderButton onClick={() => setDialogIsOpen("add-folder")} />
          </>
        }
        buttons={
          <>
            {/*<Space.Button
              icon={FolderPlusIcon}
              onClick={() => setDialogIsOpen("add-folder")}
            />*/}
            <Menu as={Space.Button} icon={EllipsisHorizontalIcon} align="right">
              <Menu.Item
                label={t.folders.deleteSpace()}
                icon={TrashIcon}
                onClick={handleDeleteSpace}
              />
            </Menu>
          </>
        }
      >
        <FolderGrid space={space} folderId={folderId} hidden={hidden} />
      </Space>
    </>
  );
}

function FolderGrid({
  space,
  folderId,
  hidden,
}: {
  space: FolderSpace;
  folderId: FolderId;
  hidden: boolean;
}) {
  const t = useTranslation();

  const push = usePush<SpaceTransactionEntry>("folders");

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
      push(
        createTransaction((t) =>
          t.target(`${folderId}:${space.id}`).splice(...ops)
        )
      );
    },
    [push, folderId, space.id]
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
          "grid grid-cols-1 @lg:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4 gap-2 @md:pl-9 min-h-[1.5rem]"
        )}
      >
        {space.items.length === 0 && (
          <div className="absolute text-gray-400 text-sm">
            {t.folders.noFolders()}
          </div>
        )}
        {space.items.map((id, index) => (
          <FolderItem folder={id} index={index} key={id} />
        ))}
        <DropShadow>
          {(item) => {
            return <FolderItem index={space.items.length} folder={item} />;
          }}
        </DropShadow>
      </div>
    </Sortable>
  );
}

function AddFolderButton({ onClick }: { onClick: any }) {
  const t = useTranslation();
  return (
    <button
      className={cl(
        "rounded-full px-2 py-0.5 text-xs ring-button text-gray-600 dark:text-gray-400 ml-3 flex-center gap-1"
        // "opacity-0 group-hover/space:opacity-100 transition-opacity"
      )}
      onClick={onClick}
    >
      <PlusIcon className="w-3 h-3" /> {t.folders.addFolder()}
    </button>
  );
}
