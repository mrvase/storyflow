import cl from "clsx";
import {
  BookmarkIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  FolderIcon,
  HomeIcon,
  PlusIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import Loader from "../../elements/Loader";
import useLocationLabel from "./useLocationLabel";
import { PanelData } from "../../panel-router/types";
import { usePanel } from "../../panel-router/Routes";
import { usePanelActions } from "../../panel-router/PanelRouter";

export default function LocationBar({
  isFocused,
  dragHandleProps,
  data,
}: {
  isFocused: boolean;
  dragHandleProps: any;
  data: PanelData;
}) {
  const actions = usePanelActions();
  const [{ path }, navigate, close] = usePanel(data);

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
          "h-11 shrink-0 grow-0 flex items-center pl-5 text-sm font-light",
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
        "h-11 shrink-0 grow-0 overflow-x-auto text-gray-600 dark:text-white",
        "bg-white dark:bg-gray-850"
        // isFocused ? "bg-white dark:bg-gray-850" : "bg-white dark:bg-gray-900"
      )}
    >
      <div
        className={cl("h-full flex", isFocused ? "opacity-100" : "opacity-25")}
        {...dragHandleProps}
      >
        <div className="flex gap-2 pl-2 h-full overflow-x-auto no-scrollbar grow">
          {segments.map((segment, index) => (
            <LocationBarItem
              key={segment}
              segment={segment}
              isCurrent={index === segments.length - 1}
              onHover={() => {}}
              navigate={navigate}
            />
          ))}
        </div>
        <button
          className={cl(
            "shrink-0 ml-auto flex items-center justify-center h-full px-3"
          )}
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>
        <button
          className={cl(
            "shrink-0 flex items-center justify-center h-full px-3"
          )}
          onClick={(ev) => {
            ev.stopPropagation();
            actions.open({
              path,
              index: data.index + 1,
            });
          }}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
        <button
          className="shrink-0 flex items-center justify-center h-full px-3"
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

function LocationBarItem({
  segment,
  isCurrent,
  navigate,
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
  onHover: () => void;
}) {
  const { label, type } = useLocationLabel(segment);

  const getTitle = () => {
    if (type === "folder") {
      return (
        <div className="flex items-center">
          <FolderIcon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "app") {
      return (
        <div className="flex items-center">
          <ComputerDesktopIcon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "field") {
      return (
        <div className="flex items-center">
          <Squares2X2Icon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "document") {
      return (
        <div className="flex items-center">
          <DocumentIcon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "template") {
      return (
        <div className="flex items-center">
          <DocumentDuplicateIcon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "home") {
      return <div>{<HomeIcon className="w-4 h-4" />}</div>;
    }
    return "[Tom]";
  };

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    timer.current && clearTimeout(timer.current);
  };

  const onMouseEnter = () => {
    if (isCurrent) return;
    timer.current = setTimeout(onHover, 400);
  };

  const onMouseLeave = () => {
    clearTimer();
  };

  React.useEffect(() => clearTimer);

  return (
    <button
      className={cl(
        "px-3 my-2 h-7 text-sm leading-none rounded-md font-light",
        type === "template"
          ? "bg-teal-800"
          : /*
          : type === "app"
          ? "bg-yellow-100 dark:bg-yellow-300 text-black"
          */
          isCurrent
          ? "bg-white dark:bg-gray-850"
          : "bg-button ring-button text-button"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => navigate(`/${segment}`, { navigate: true })}
    >
      {type === "loading" ? (
        <Loader />
      ) : (
        <span className="truncate">{getTitle()}</span>
      )}
    </button>
  );
}
