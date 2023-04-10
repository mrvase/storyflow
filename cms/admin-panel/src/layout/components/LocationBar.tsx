import cl from "clsx";
import {
  Bars3BottomLeftIcon,
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
import { PanelData } from "../../panel-router/types";
import { usePanel } from "../../panel-router/Routes";
import { usePanelActions } from "../../panel-router/PanelRouter";
import { useDragItem } from "@storyflow/dnd";
import { parseSegment } from "./routes";
import { useOptimisticDocumentList, useArticle } from "../../documents";
import { useLabel } from "../../documents/collab/hooks";
import { useDocumentLabel } from "../../documents/useDocumentLabel";
import { useFolder } from "../../folders/collab/hooks";
import { ROOT_FOLDER } from "@storyflow/backend/constants";

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
        className={cl(
          "h-full flex pr-2",
          isFocused ? "opacity-100" : "opacity-25"
        )}
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
              panelIndex={panelIndex}
            />
          ))}
        </div>
        <button
          className={cl(
            "shrink-0 ml-auto flex items-center justify-center h-full px-2",
            "opacity-50 hover:opacity-100 transition-opacity"
          )}
        >
          <BookmarkIcon className="w-4 h-4" />
        </button>
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
          <PlusIcon className="w-4 h-4" />
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

  if (type === "field") {
    label = useLabel(data.id);
  } else if (type === "folder" || type === "app") {
    const { articles, error } = useOptimisticDocumentList(data.id);
    label = useFolder(data.id)?.label ?? "";

    if (!articles && !error) {
      loading = true;
    }
  } else if (type === "document" || type === "template") {
    let { article, error } = useArticle(data.id);
    label = useDocumentLabel(article) ?? "";

    if (!article && !error) {
      loading = true;
    }
  }

  const Icon = {
    folder: FolderIcon,
    app: ComputerDesktopIcon,
    field: Bars3BottomLeftIcon,
    document: DocumentIcon,
    template: DocumentIcon,
  }[type];

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
        </div>
      )}
    </button>
  );
}
