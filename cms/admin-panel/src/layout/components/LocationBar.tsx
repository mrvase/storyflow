import cl from "clsx";
import { Link } from "@storyflow/router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  FolderIcon,
  HomeIcon,
  Square2StackIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import Loader from "../../elements/Loader";
import { useFolders } from "../../folders/folders-context";
import { Tab } from "../types";
import useLocationLabel from "../useLocationLabel";
import { useTabUrl } from "../utils";
import { useBranchIsFocused } from "./Branch";

export default function LocationBar({
  tab,
  isFocused,
  dragHandleProps,
  selected,
  setSelected,
  segments,
  pinned,
  togglePin,
}: {
  tab: Tab;
  segments: string[];
  isFocused: boolean;
  selected: string;
  setSelected: (value: string) => void;
  dragHandleProps: any;
  pinned: boolean;
  togglePin: () => void;
}) {
  const [, navigateTab] = useTabUrl();

  const segmentsMemo = React.useRef<string[]>([]);
  const prevSegment = React.useRef<string>("");

  React.useEffect(() => {
    if (
      prevSegment.current.startsWith(tab.segment) &&
      prevSegment.current.length > tab.segment.length
    ) {
      segmentsMemo.current.unshift(prevSegment.current);
    } else {
      segmentsMemo.current = [];
    }
    prevSegment.current = tab.segment;
  }, [tab.segment]);

  const { folders } = useFolders();

  const [query, setQuery] = React.useState("");

  const suggestion = React.useMemo(() => {
    if (query === "") {
      return;
    }
    return folders?.find((el) =>
      el.label.toLowerCase().startsWith(query.toLowerCase())
    );
  }, [query]);

  return (
    <div
      className={cl(
        "h-12 shrink-0 overflow-x-auto text-gray-600 dark:text-white bg-white dark:bg-gray-850"
      )}
    >
      <div
        className={cl(
          "h-full flex dark:bg-gray-850",
          isFocused ? "opacity-100" : "opacity-25"
        )}
        {...dragHandleProps}
      >
        <Link
          to={navigateTab(tab.segment.split("/").slice(0, -1).join("/"), {
            navigate: false,
          })}
          className="shrink-0 h-full w-10 pl-1 flex-center"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </Link>
        {segmentsMemo.current[0] ? (
          <Link
            to={navigateTab(segmentsMemo.current[0] ?? "", {
              navigate: false,
            })}
            className="shrink-0 h-full w-10 pr-1 flex-center"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        ) : (
          <div className="shrink-0 h-full w-10 pr-1 flex-center">
            <ChevronRightIcon className="w-4 h-4" />
          </div>
        )}
        <div className="flex gap-2 h-full overflow-x-auto no-scrollbar grow">
          {segments.map((el) => (
            <LocationBarItem
              key={el}
              segment={el}
              current={selected === el}
              onHover={() => setSelected(el)}
            />
          ))}
          <div className="flex h-full grow text-[0px] relative">
            <div className="px-1 h-full flex items-center text-sm absolute pointer-events-none opacity-50">
              <span className="text-transparent">
                {(suggestion?.label ?? query).slice(0, query.length)}
              </span>
              <span>{(suggestion?.label ?? "").slice(query.length)}</span>
            </div>
            <input
              type="text"
              className={cl(
                "px-1 m-0 py-2.5 text-sm w-0 min-w-[100px] grow bg-transparent outline-none",
                !query
                  ? "dark:text-white"
                  : suggestion
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
              value={(suggestion?.label ?? query).slice(0, query.length)}
              onMouseEnter={() => setSelected(segments[segments.length - 1])}
              onChange={(ev) => setQuery(ev.target.value)}
            />
          </div>
        </div>

        <button
          className={cl(
            "shrink-0 ml-auto mr-2 flex items-center justify-center h-full px-3",
            pinned && "text-teal-500"
          )}
          onClick={() => togglePin()}
        >
          <Square2StackIcon className="w-4 h-4" />
        </button>
        <button
          className="shrink-0 mr-2 ml-auto flex items-center justify-center h-full px-3"
          onMouseDown={(ev) => ev.stopPropagation()} // prevent focus
          onClick={(ev) => {
            ev.stopPropagation();
            navigateTab(tab.segment, { close: true });
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
  current,
  onHover,
}: {
  segment: string;
  current: boolean;
  onHover: () => void;
}) {
  const { isFocused } = useBranchIsFocused();

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
    if (type === "component") {
      return (
        <div className="flex items-center">
          <Squares2X2Icon className="w-4 h-4 mr-2" /> {label}
        </div>
      );
    }
    if (type === "data") {
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

  const [, navigateTab] = useTabUrl();

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    timer.current && clearTimeout(timer.current);
  };

  const onMouseEnter = () => {
    if (current) return;
    timer.current = setTimeout(onHover, 100);
  };

  const onMouseLeave = () => {
    clearTimer();
  };

  React.useEffect(() => clearTimer);

  return (
    <button
      className={cl(
        "px-3 my-2 h-8 text-sm leading-none rounded-md font-light",
        type === "template"
          ? "bg-teal-800"
          : type === "app"
          ? "bg-yellow-100 dark:bg-yellow-300 text-black"
          : current
          ? "bg-gray-100 dark:bg-gray-700/50"
          : "bg-white dark:bg-gray-850"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => navigateTab(segment)}
    >
      {type === "loading" ? (
        <Loader />
      ) : (
        <span className="truncate">{getTitle()}</span>
      )}
    </button>
  );
}
