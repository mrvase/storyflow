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
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useContextWithError } from "../../utils/contextError";
import ReactDOM from "react-dom";

type Portals = [HTMLDivElement | null, HTMLElement | null];

const ToolbarPortalContext = React.createContext<
  [Portals, React.Dispatch<React.SetStateAction<Portals>>] | null
>(null);

export function ToolbarPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<Portals>([null, null]);
  return (
    <ToolbarPortalContext.Provider value={state}>
      {children}
    </ToolbarPortalContext.Provider>
  );
}

export function ToolbarPortal({
  children,
  show,
  secondary,
}: {
  children: React.ReactNode;
  show: boolean;
  secondary?: boolean;
}) {
  const [portals] = useContextWithError(ToolbarPortalContext, "ToolbarPortal");

  const portal = portals[secondary ? 1 : 0];

  return portal && show ? ReactDOM.createPortal(children, portal) : null;
}

export function LocationBar({
  isFocused,
  dragHandleProps,
  matches = [],
}: {
  isFocused: boolean;
  dragHandleProps: any;
  matches?: ReturnType<typeof useMatches>;
}) {
  const [, setToolbar] = useContextWithError(
    ToolbarPortalContext,
    "ToolbarPortal"
  );

  const { pathname } = usePath();
  const route = useRoute();

  const isSystemWindow = pathname !== "/~" && !pathname.match(/^\/~\/\w\//);

  if (isSystemWindow) {
    return (
      <div
        className={cl(
          "h-20 flex justify-between",
          isFocused ? "opacity-100" : "opacity-25"
        )}
      >
        <div className="flex">
          <Link
            to={route.accumulated.split("/").slice(0, -1).join("/")}
            className={cl(
              "group h-20 flex-center ml-2.5 w-10 transition-colors",
              matches.length === 1 && "opacity-0 pointer-events-none"
            )}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300" />
          </Link>
        </div>
        <div className="flex items-center pr-3.5 gap-2.5">
          <button
            className={cl(
              "shrink-0 flex items-center justify-center h-full px-1.5",
              "opacity-50 hover:opacity-100 transition-opacity"
            )}
            onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
            onClick={(ev) => {
              actions.open({ path: pathname, index: route.index + 1 });
            }}
          >
            <Square2StackIcon className="w-5 h-5" />
          </button>
          <button
            className={cl(
              "shrink-0 flex items-center justify-center h-full px-1.5",
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

  const setPrimaryPortal = React.useCallback(
    (ref: HTMLDivElement | null) => setToolbar((ps) => [ref, ps[1]]),
    []
  );
  const setSecondaryPortal = React.useCallback(
    (ref: HTMLDivElement | null) => setToolbar((ps) => [ps[0], ref]),
    []
  );

  return (
    <div className="relative w-full shrink-0 grow-0" {...dragHandleProps}>
      <div
        className={cl(
          "h-20 flex justify-between",
          isFocused ? "opacity-100" : "opacity-25"
        )}
      >
        <div className="flex">
          <Link
            to={route.accumulated.split("/").slice(0, -2).join("/")}
            className={cl(
              "group h-20 flex-center ml-2.5 w-10 transition-colors",
              matches.length === 1 && "opacity-0 pointer-events-none"
            )}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300" />
          </Link>

          <div className="flex gap-4 pl-2.5 h-full overflow-x-auto no-scrollbar">
            {matches.map((match, index) => (
              <React.Fragment key={match.accumulated}>
                {index > 0 && (
                  <ChevronRightIcon className="w-2.5 h-2.5 self-center" />
                )}
                <LocationBarItem
                  match={match}
                  isCurrent={index === matches.length - 1}
                  panelIndex={route.index}
                />
              </React.Fragment>
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
        </div>
        <div className="flex items-center pr-3.5 gap-2.5">
          <div ref={setPrimaryPortal} className="flex h-20 items-center" />
          <button
            className={cl(
              "shrink-0 flex items-center justify-center h-full px-1.5",
              "opacity-50 hover:opacity-100 transition-opacity"
            )}
            onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
            onClick={(ev) => {
              actions.open({ path: pathname, index: route.index + 1 });
            }}
          >
            <Square2StackIcon className="w-5 h-5" />
          </button>
          <button
            className={cl(
              "shrink-0 flex items-center justify-center h-full px-1.5",
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
      <div ref={setSecondaryPortal} className="w-full" />
    </div>
  );
}

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
        "group h-20 text-sm leading-none rounded-md",
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
