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

export default function FolderUI({
  index,
  folder,
}: {
  index: number;
  folder: DBFolder;
}) {
  const { current, full } = useSegment();

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
      "text-gray-700 dark:text-white",
      isOpen
        ? "bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
        : "bg-gray-100 dark:border-gray-800 dark:bg-gray-800 hover:dark:border-gray-600"
    ),
    app: cl(
      "dark:text-white dark:border-yellow-300 dark:text-yellow-300",
      isOpen
        ? "bg-yellow-50 dark:bg-gray-700/75"
        : "bg-yellow-100 dark:bg-gray-800 hover:dark:bg-gray-700/75 hover:dark:border-yellow-200 hover:dark:text-yellow-200"
    ),
    root: "",
    templates: "",
  }[folder.type];

  return (
    <div className="w-56 child:last:mb-10">
      <Link
        ref={ref as any}
        to={navigateTab(to, { navigate: false })}
        className={cl(
          "group flex items-center px-3 py-4 rounded-md text-lg font-light transition-colors border-2",
          colors
        )}
        style={style}
        {...dragHandleProps}
      >
        <Icon className="w-5 h-5 mr-3 shrink-0 opacity-75" />{" "}
        <span className="truncate">{label}</span>
        <div
          className="ml-auto opacity-20 transition-[opacity,background] w-8 h-8 flex-center hover:bg-black/5 dark:hover:bg-white/5 hover:opacity-80 rounded-md"
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            navigateTab(`/~${parseInt(to.slice(2, 4), 10) + 1}/${to.slice(4)}`);
          }}
        >
          <ArrowTopRightOnSquareIcon className="w-5 h-5" />
        </div>
      </Link>
    </div>
  );
}