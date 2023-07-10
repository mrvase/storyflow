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
import { isCustomFolder } from "@storyflow/cms/ids";

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

  const isCustom = isCustomFolder(folder._id);

  const colors = {
    data: cl(
      "bg-gray-50 dark:bg-gray-850",
      isOpen
        ? "border-gray-300 dark:border-gray-600"
        : "border-gray-100 hover:border-gray-300 dark:border-gray-800 hover:dark:border-gray-600"
    ),
    app: cl(
      "bg-yellow-50 text-yellow-800 dark:text-yellow-200 dark:bg-yellow-800/10",
      isOpen
        ? "border-gray-300 dark:border-gray-600"
        : "border-yellow-200 hover:border-yellow-400 dark:border-yellow-400/10 hover:dark:border-yellow-400/40"
    ),
    custom: cl(
      "bg-purple-50 text-purple-800 dark:text-purple-200 dark:bg-purple-800/10",
      "border-purple-200 hover:border-purple-400 dark:border-purple-400/10 hover:dark:border-purple-400/40"
    ),
  }[isCustom ? "custom" : type];

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
        "group flex items-center px-4 py-5 rounded-lg transition-[border] border",
        colors
      )}
      style={style}
    >
      {isEditing && (
        <div
          className="w-5 h-5 shrink-0 opacity-75 hover:opacity-100 transition-opacity cursor-grab"
          {...dragHandleProps}
        >
          <DragIcon className="w-5 h-5 text-yellow-500 dark:text-yellow-200" />
        </div>
      )}
      <span className="ml-3 truncate">{label}</span>
      <div className="ml-auto transition-opacity w-8 h-8 flex-center">
        <Icon className="w-6 h-6 shrink-0 opacity-25 group-hover:opacity-50 transition-opacity" />{" "}
      </div>
    </Link>
  );
}
