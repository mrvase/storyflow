import React from "react";
import cl from "clsx";
import { Link, usePath, useRoute } from "@nanokit/router";
import {
  ComputerDesktopIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { useDragItem, useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import type { DBFolder } from "@storyflow/cms/types";
import type { FolderId } from "@storyflow/shared/types";
import { DragIcon } from "../../elements/DragIcon";
import { useFolder } from "../FoldersContext";
import { getFolderData } from "../getFolderData";
import { useLocalStorage } from "../../state/useLocalStorage";

export function FolderItem({
  index,
  folder: folder_,
}: {
  index: number;
  folder: DBFolder | FolderId;
}) {
  const { pathname } = usePath();
  const route = useRoute();

  const folder = typeof folder_ === "string" ? useFolder(folder_) : folder_;
  const { type } = getFolderData(folder);

  const isOpen = pathname.startsWith(`${route.accumulated}/f/${folder._id}`);

  const to = `${route.accumulated}/f/${parseInt(folder._id, 16).toString(16)}`;

  if (!folder) {
    return null;
  }

  const Icon = {
    data: isOpen ? FolderOpenIcon : FolderIcon,
    app: ComputerDesktopIcon,
  }[type];

  const label = folder.label;

  const { dragHandleProps, ref, state } = useSortableItem({
    id: folder._id,
    index,
    item: folder,
  });

  const style = getTranslateDragEffect(state);

  const colors = {
    data: cl(
      "text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-850", // dark:bg-gradient-to-b dark:from-gray-825 dark:to-gray-835
      isOpen
        ? "border-gray-300 dark:border-gray-600"
        : "border-gray-100 hover:border-gray-300 dark:border-gray-700 hover:dark:border-gray-600"
    ),
    app: cl(
      "dark:text-white dark:text-yellow-300 bg-yellow-100 dark:bg-gray-850 dark:border-yellow-300/40",
      isOpen
        ? "border-yellow-300 dark:border-yellow-600"
        : "border-yellow-100 hover:border-yellow-300 hover:dark:border-yellow-300"
    ),
  }[type];

  const { index: panelIndex } = useRoute("parallel");

  const { dragHandleProps: linkDragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  const [isEditing] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <Link
      {...linkDragHandleProps}
      ref={ref as any}
      to={to}
      className={cl(
        "group flex items-center px-3 py-4 rounded-md text-lg transition-[border] border",
        colors
      )}
      style={style}
    >
      {isEditing && (
        <div
          className="w-5 h-5 shrink-0 opacity-75 hover:opacity-100 transition-opacity cursor-grab"
          {...dragHandleProps}
        >
          <DragIcon className="w-5 h-5 text-yellow-200" />
        </div>
      )}
      <span className="ml-3 truncate">{label}</span>
      <div className="ml-auto transition-opacity w-8 h-8 flex-center rounded-md">
        <Icon className="w-6 h-6 shrink-0 opacity-25 group-hover:opacity-50 transition-opacity" />{" "}
      </div>
    </Link>
  );
}
