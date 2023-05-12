import cl from "clsx";
import {
  BookmarkIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  Square2StackIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import Loader from "../../elements/Loader";
import type { PanelData } from "../panel-router/types";
import { usePanel } from "../panel-router/Routes";
import { usePanelActions } from "../panel-router/PanelRouter";
import { useDragItem } from "@storyflow/dnd";
import { parseSegment } from "./parseSegment";
import { useDocumentList, useDocument } from "../../documents";
import { useLabel } from "../../documents/document-config";
import { useDocumentLabel } from "../../documents/useDocumentLabel";
import { useFolder } from "../../folders/FoldersContext";
import { Link } from "@storyflow/router";
import { getFolderData } from "../../folders/getFolderData";

export function LocationBar({
  isFocused,
  dragHandleProps,
  data,
}: {
  isFocused: boolean;
  dragHandleProps: any;
  data: PanelData;
}) {
  const actions = usePanelActions();
  const [{ path, index: panelIndex }, navigate, close] = usePanel(data);

  const segments = [
    "",
    ...path
      .split("/")
      .filter(Boolean)
      .map((_, index, arr) => arr.slice(0, index + 1).join("/")),
  ];

  const isSystemWindow = path.endsWith("folders") || path.endsWith("templates");

  if (isSystemWindow) {
    return (
      <div
        className={cl(
          "h-11 shrink-0 grow-0 flex items-center pl-5 text-sm",
          "bg-white dark:bg-gray-850"
        )}
      >
        <button
          className="shrink-0 ml-auto mr-2 flex items-center justify-center h-full px-3"
          onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
          onClick={(ev) => {
            ev.stopPropagation();
            close();
          }}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cl(
        "h-11 shrink-0 grow-0 overflow-x-auto dark:text-white",
        "bg-white dark:bg-gray-800"
        // isFocused ? "bg-white dark:bg-gray-850" : "bg-white dark:bg-gray-900"
      )}
    >
      <div
        className={cl(
          "h-full flex pr-2",
          isFocused ? "opacity-100" : "opacity-25"
        )}
        {...dragHandleProps}
      >
        {segments.length > 1 && (
          <Link
            to={navigate("/", { navigate: false })}
            className="h-11 flex-center ml-2 w-10 text-gray-500 hover:text-white transition-colors"
          >
            <HomeIcon className="w-4 h-4" />
          </Link>
        )}
        <div className="flex gap-6 pl-2 h-full overflow-x-auto no-scrollbar grow">
          {segments.slice(1).map((segment, index) => (
            <LocationBarItem
              key={segment}
              segment={segment}
              isCurrent={index === segments.length - 2}
              onHover={() => {}}
              navigate={navigate}
              panelIndex={panelIndex}
            />
          ))}
        </div>
        {/*<button
          className={cl(
            "shrink-0 ml-auto flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>*/}
        <button
          className={cl(
            "shrink-0 flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
          onClick={(ev) => {
            ev.stopPropagation();
            actions.open({
              path,
              index: data.index + 1,
            });
          }}
        >
          <Square2StackIcon className="w-4 h-4" />
        </button>
        <button
          className={cl(
            "shrink-0 flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
          onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
          onClick={(ev) => {
            ev.stopPropagation();
            close();
          }}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

const loadingState = {
  type: "loading",
  label: "",
};

function LocationBarItem({
  segment,
  isCurrent,
  navigate,
  panelIndex,
  onHover,
}: {
  segment: string;
  isCurrent: boolean;
  navigate: (
    path: string,
    options?: {
      navigate?: boolean | undefined;
    }
  ) => string;
  panelIndex: number;
  onHover: () => void;
}) {
  const data = parseSegment(segment);

  const type = data.type;

  let loading = false;
  let label = "";
  let Icon: React.FC<{ className?: string }>;
  let isModified = false;
  let isNew = false;

  if (type === "field") {
    label = useLabel(data.id);
    Icon = WindowIcon;
  } else if (type === "folder") {
    const { documents, error } = useDocumentList(data.id);
    const folder = useFolder(data.id);
    const folderData = getFolderData(folder);
    label = folder?.label ?? "";

    if (!documents && !error) {
      loading = true;
    }

    Icon = folderData.type === "app" ? ComputerDesktopIcon : FolderIcon;
  } else if (type === "document" || type === "template") {
    let { doc, error } = useDocument(data.id);
    ({ label = "", isModified } = useDocumentLabel(doc));

    if (!doc && !error) {
      loading = true;
    }

    isNew = Boolean(doc && !doc.folder);
    Icon = type === "template" ? DocumentDuplicateIcon : DocumentIcon;
  } else {
    throw new Error("Url is not valid");
  }

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    timer.current && clearTimeout(timer.current);
  };

  React.useEffect(() => clearTimer);

  const to = `/${segment}`;

  const { dragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  return (
    <button
      {...dragHandleProps}
      className={cl(
        "my-2 h-7 text-sm leading-none rounded-md font-medium",
        !isCurrent
          ? "text-gray-500 hover:text-white transition-colors"
          : type === "template"
          ? "text-teal-400"
          : ""
      )}
      // onMouseEnter={onMouseEnter}
      // onMouseLeave={onMouseLeave}
      onClick={() => navigate(to, { navigate: true })}
    >
      {loading ? (
        <Loader />
      ) : (
        <div className="flex items-center">
          <Icon className="w-4 h-4" />
          <span
            className={cl("truncate ml-2", !isCurrent && "hidden @lg:block")}
          >
            {label}
          </span>
          {isModified && (
            <div
              className={cl(
                "w-2 h-2 rounded ml-2",
                isNew ? "bg-yellow-400" : "bg-teal-400"
              )}
            />
          )}
        </div>
      )}
    </button>
  );
}
