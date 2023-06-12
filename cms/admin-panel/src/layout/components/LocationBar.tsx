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
} from "@heroicons/react/24/solid";
import React from "react";
import Loader from "../../elements/Loader";
import { useDragItem } from "@storyflow/dnd";
import { parseMatch } from "./parseSegment";
import { useDocumentList, useDocument } from "../../documents";
import { useLabel } from "../../documents/document-config";
import { useDocumentLabel } from "../../documents/useDocumentLabel";
import { useFolder } from "../../folders/FoldersContext";
import { Link } from "@nanokit/router";
import { getFolderData } from "../../folders/getFolderData";
import { useNavigate, usePath, useRoute, useMatches } from "@nanokit/router";
import { actions } from "../../pages/routes";

export function LocationBar({
  isFocused,
  dragHandleProps,
  matches = [],
}: {
  isFocused: boolean;
  dragHandleProps: any;
  matches?: ReturnType<typeof useMatches>;
}) {
  const { pathname } = usePath();
  const route = useRoute();

  const isSystemWindow = pathname !== "/~" && !pathname.match(/^\/~\/\w\//);

  if (isSystemWindow) {
    return (
      <div className="relative w-full shrink-0 grow-0" {...dragHandleProps}>
        <div
          className={cl(
            "h-16 flex pr-2 overflow-x-auto dark:text-white",
            isFocused ? "opacity-100" : "opacity-25"
          )}
        >
          <Link
            to="/~"
            className="h-12 flex-center ml-2 w-10 text-gray-500 hover:text-white transition-colors"
          >
            <HomeIcon className="w-5 h-5" />
          </Link>
          <button
            className="shrink-0 ml-auto mr-2 flex items-center justify-center h-full px-3"
            onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
            onClick={(ev) => {
              ev.stopPropagation();
              actions.close(route.index);
            }}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full shrink-0 grow-0" {...dragHandleProps}>
      <div
        className={cl(
          "h-12 pt-4 flex pr-2 overflow-x-auto dark:text-white",
          isFocused ? "opacity-100" : "opacity-25"
        )}
      >
        {matches.length > 1 && (
          <Link
            to="/~"
            className="group h-8 flex-center ml-2.5 w-10 transition-colors"
          >
            <HomeIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300" />
          </Link>
        )}
        <div className="flex gap-6 pl-2.5 h-full overflow-x-auto no-scrollbar grow">
          {matches.slice(1).map((match, index) => (
            <LocationBarItem
              key={match.accumulated}
              match={match}
              isCurrent={index === matches.length - 2}
              panelIndex={route.index}
            />
          ))}
        </div>
        {/*<button
          className={cl(
            "shrink-0 ml-auto flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
        >
          <BookmarkIcon className="w-5 h-5" />
        </button>*/}
        <button
          className={cl(
            "shrink-0 flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
          onClick={(ev) => {
            ev.stopPropagation();
            actions.open({
              path: pathname,
              index: route.index + 1,
            });
          }}
        >
          <Square2StackIcon className="w-5 h-5" />
        </button>
        <button
          className={cl(
            "shrink-0 flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
          onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
          onClick={(ev) => {
            ev.stopPropagation();
            actions.close(route.index);
          }}
        >
          <XMarkIcon className="w-5 h-5" />
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
  match,
  isCurrent,
  panelIndex,
}: {
  match: ReturnType<typeof useMatches>[number];
  isCurrent: boolean;
  panelIndex: number;
}) {
  const data = parseMatch(match);
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

  const to = match.accumulated;

  const { dragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  const navigate = useNavigate();

  return (
    <button
      {...dragHandleProps}
      className={cl(
        "group h-8 text-sm leading-none rounded-md",
        !isCurrent
          ? "text-gray-600 dark:text-gray-200 hover:text-gray-850 dark:hover:text-white transition-colors font-semibold hover:underline"
          : type === "template"
          ? "text-teal-400"
          : "text-gray-800 dark:text-gray-200 font-normal"
      )}
      // onMouseEnter={onMouseEnter}
      // onMouseLeave={onMouseLeave}
      onClick={() => navigate(to)}
    >
      {loading ? (
        <Loader />
      ) : (
        <div className="flex items-center">
          {/*<Icon
            className={cl(
              "w-5 h-5 transition-colors",
              isCurrent
                ? "text-gray-500 dark:text-gray-400"
                : "text-gray-400 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
            )}
          />*/}
          <span className={cl("truncate", !isCurrent && "hidden @lg:block")}>
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
