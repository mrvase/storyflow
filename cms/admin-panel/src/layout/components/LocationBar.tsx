import cl from "clsx";
import {
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
import { Tab } from "../types";
import useLocationLabel from "../useLocationLabel";
import { useTabUrl } from "../utils";

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

  const isSystemWindow = tab.segment.startsWith("/~0");

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

  /*
  const [query, setQuery] = React.useState("");

  const suggestion = React.useMemo(() => {
    if (query === "") {
      return;
    }
    return folders?.find((el) =>
      el.label.toLowerCase().startsWith(query.toLowerCase())
    );
  }, [query]);
  */

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
            navigateTab(tab.segment, { close: true });
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
          {segments.map((el) => (
            <LocationBarItem
              key={el}
              segment={el}
              current={selected === el}
              onHover={() => setSelected(el)}
            />
          ))}
          {/*
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
        */}
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
          current
          ? "bg-white dark:bg-gray-850"
          : "bg-button ring-button text-button"
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
