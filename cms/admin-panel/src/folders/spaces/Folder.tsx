import React from "react";
import cl from "clsx";
import { Link } from "@storyflow/router";
import {
  ComputerDesktopIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { useDragItem, useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import type { DBFolder } from "@storyflow/db-core/types";
import type { FolderId } from "@storyflow/shared/types";
import { DragIcon } from "./DragIcon";
import { usePanel, useRoute } from "../../panel-router/Routes";
import { useFolder } from "../FoldersContext";

export function FolderItem({
  index,
  folder: folder_,
}: {
  index: number;
  folder: DBFolder | FolderId;
}) {
  const [{ path, index: panelIndex }, navigate] = usePanel();
  const route = useRoute();

  const folder = typeof folder_ === "string" ? useFolder(folder_) : folder_;

  const typeCode = { data: "f", app: "a" }[folder.type as "data"] ?? "f";

  const isOpen = path.startsWith(`${route}/${typeCode}${folder._id}`);

  const to = `${route}/${typeCode}${parseInt(folder._id, 16).toString(16)}`;

  if (!folder) {
    return null;
  }

  const Icon =
    {
      data: isOpen ? FolderOpenIcon : FolderIcon,
      app: ComputerDesktopIcon,
      root: () => null,
      templates: () => null,
    }[folder.type ?? "data"] ?? React.Fragment;

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
    root: "",
    templates: "",
  }[folder.type];

  const { dragHandleProps: linkDragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  return (
    <Link
      {...linkDragHandleProps}
      ref={ref as any}
      to={navigate(to, { navigate: false })}
      className={cl(
        "group flex items-center px-3 py-4 rounded-md text-lg transition-colors border",
        colors
      )}
      style={style}
    >
      <div
        className="w-4 h-4 mr-3 shrink-0 opacity-25 hover:opacity-100 transition-opacity cursor-grab"
        {...dragHandleProps}
      >
        <DragIcon className="w-4 h-4" />
      </div>
      <span className="truncate">{label}</span>
      <div className="ml-auto transition-opacity w-8 h-8 flex-center rounded-md">
        <Icon className="w-5 h-5 shrink-0 opacity-25 group-hover:opacity-75 transition-opacity" />{" "}
      </div>
    </Link>
  );
}
