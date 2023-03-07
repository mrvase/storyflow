import React from "react";
import cl from "clsx";
import { Link } from "@storyflow/router";
import {
  ArrowTopRightOnSquareIcon,
  ComputerDesktopIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import { DBFolder } from "@storyflow/backend/types";
import { useTabUrl } from "../../layout/utils";
import { useSegment } from "../../layout/components/SegmentContext";
import { restoreId } from "@storyflow/backend/ids";
import { DragIcon } from "./DragIcon";
import { useFolder } from "../../state/collab-folder";

export function FolderItem({
  index,
  folder: folder_,
}: {
  index: number;
  folder: DBFolder | string;
}) {
  const { current, full } = useSegment();

  const folder = typeof folder_ === "string" ? useFolder(folder_) : folder_;

  const typeCode = { data: "f", app: "a" }[folder.type as "data"] ?? "f";

  const isOpen = full.startsWith(
    `${current}/${typeCode}-${restoreId(folder.id)}`
  );

  const to = `${current}/${typeCode}-${restoreId(folder.id)}`;

  const [, navigateTab] = useTabUrl();

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
    id: folder.id,
    index,
    item: folder,
  });

  const style = getTranslateDragEffect(state);

  const colors = {
    data: cl(
      "text-gray-700 dark:text-white bg-gray-50 dark:bg-gray-850", // dark:bg-gradient-to-b dark:from-gray-825 dark:to-gray-835
      isOpen
        ? "border-gray-300 dark:border-gray-600"
        : "border-gray-100 hover:border-gray-300 dark:border-gray-750 hover:dark:border-gray-600"
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

  return (
    <div className="w-56">
      <Link
        ref={ref as any}
        to={navigateTab(to, { navigate: false })}
        className={cl(
          "group flex items-center px-3 py-4 rounded-md text-lg font-light transition-colors border",
          colors
        )}
        style={style}
      >
        <div
          className="w-4 h-4 mr-3 shrink-0 opacity-75 cursor-grab"
          {...dragHandleProps}
        >
          <DragIcon className="w-4 h-4" />
        </div>
        <span className="truncate">{label}</span>
        <div className="ml-auto transition-opacity w-8 h-8 flex-center rounded-md">
          <Icon className="w-5 h-5 shrink-0 opacity-25 group-hover:opacity-75 transition-opacity" />{" "}
        </div>
      </Link>
    </div>
  );
}
