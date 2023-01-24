import React from "react";
import {
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  PlusIcon,
  ArrowsPointingOutIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  ArrowDownCircleIcon,
  Bars3Icon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import TabButton from "./TabButton";
import { Tab } from "../types";
import cl from "clsx";
import { useLocalStorage } from "../../state/useLocalStorage";
import { useCollab } from "../../state/collaboration";

export default function TabBar({
  tabs,
  autoSizeTabs,
  setNoOfTabs,
  addTab,
}: {
  tabs: Tab[];
  autoSizeTabs: boolean;
  setNoOfTabs: (callback: (ps: number | null) => number | null) => void;
  addTab: () => void;
}) {
  const [, setSidebarIsOpen] = useLocalStorage<boolean>(
    "sidebar-is-open",
    false
  );
  const [navIsOpen, setNavIsOpen] = useLocalStorage<boolean>(
    "nav-is-open",
    true
  );

  return (
    <div
      className={cl("flex px-2 pb-2 gap-2", "text-gray-600 dark:text-gray-200")}
    >
      <button
        className={cl(
          "text-sm h-7 px-2 flex items-center rounded-md transition-colors",
          "bg-gray-300 hover:bg-gray-400 hover:text-white text-gray-600",
          "dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:hover:text-white"
        )}
        onClick={() => setNavIsOpen((ps) => !ps)}
      >
        {navIsOpen ? (
          <ChevronLeftIcon className="w-4 h-4" />
        ) : (
          <Bars3Icon className="w-4 h-4" />
        )}
      </button>
      <div
        className={cl(
          "w-full flex gap-2 justify-start items-start",
          "transition-transform ease-out"
        )}
      >
        {tabs.map((el, i) => (
          <TabButton key={el.key} isCurrent={i < 2} tab={el} />
        ))}
        <button
          onClick={addTab}
          className="flex items-center bg-white dark:bg-gray-800 dark:text-gray-100 px-2 rounded-md h-7 hover:opacity-100 transition-opacity"
          style={{
            order: 999,
          }}
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex text-sm bg-white dark:bg-gray-800 rounded-md">
        <button
          className="flex items-center px-2"
          onClick={() =>
            setNoOfTabs((ps) => {
              let ps2 = typeof ps === "number" ? ps : tabs.length;
              return ps2 === 4 ? 4 : ps2 + 1;
            })
          }
        >
          <MagnifyingGlassMinusIcon className="w-4 h-4" />
        </button>
        <button
          className={cl(
            "flex items-center px-2",
            autoSizeTabs
              ? "bg-teal-100 text-teal-600 dark:bg-teal-600 dark:text-teal-100"
              : ""
          )}
          onClick={() =>
            setNoOfTabs((ps) => (ps === null ? tabs.length : null))
          }
        >
          <ArrowsPointingOutIcon className="w-4 h-4" />
        </button>
        <button
          className="flex items-center px-2"
          onClick={() =>
            setNoOfTabs((ps) => {
              let ps2 = typeof ps === "number" ? ps : tabs.length;
              return ps2 === 1 ? 1 : ps2 - 1;
            })
          }
        >
          <MagnifyingGlassPlusIcon className="w-4 h-4" />
        </button>
      </div>
      {/*<button
        className="flex items-center text-sm bg-white dark:bg-gray-800 rounded-md px-2"
        onClick={() => setDarkMode((ps) => !ps)}
      >
        <DarkIcon className="w-4 h-4" />
        </button>*/}
      <StatusButton />
      <button
        className="text-sm h-7 px-2 flex items-center rounded-md bg-gray-800 bg-opacity-90 text-gray-300 hover:text-white hover:bg-opacity-100 transition-colors"
        onClick={() => setSidebarIsOpen((ps) => !ps)}
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function StatusButton() {
  const [isModified, setIsModified] = React.useState(false);
  const [collabState, setCollabState] = React.useState<"loading" | "done">(
    "done"
  );

  const getIcon = ({
    collabState,
    isModified,
  }: {
    collabState: "loading" | "done";
    isModified: boolean;
  }) => {
    if (collabState === "loading") {
      return isModified ? "uploading" : "downloading";
    } else {
      return isModified ? "modified" : "default";
    }
  };

  const [current, setCurrent] = React.useState(() =>
    getIcon({ isModified, collabState })
  );

  const modifiedAt = React.useRef<number>(Date.now());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const changeState = (newState: {
    isModified?: boolean;
    collabState?: "loading" | "done";
  }) => {
    if (newState.isModified !== undefined) {
      setIsModified(newState.isModified);
    }
    if (newState.collabState !== undefined) {
      setCollabState(newState.collabState);
    }
    const state = {
      isModified,
      collabState,
      ...newState,
    };
    if (timer.current) {
      clearTimeout(timer.current);
    }
    const diff = Date.now() - modifiedAt.current;
    if (diff < 350) {
      timer.current = setTimeout(() => {
        modifiedAt.current = Date.now();
        setCurrent(getIcon(state));
      }, 350 - diff);
    } else {
      modifiedAt.current = Date.now();
      setCurrent(getIcon(state));
    }
  };

  const collab = useCollab();

  React.useEffect(() => {
    return collab.registerEventListener((event) => {
      changeState({
        collabState: event,
        ...(event === "done" && { isModified: false }),
      });
    });
  }, [isModified, collabState]);

  React.useEffect(() => {
    return collab.registerMutationListener(() => {
      changeState({
        isModified: true,
      });
    });
  }, [isModified, collabState]);

  const Icon = {
    uploading: ArrowUpCircleIcon,
    downloading: ArrowDownCircleIcon,
    modified: MinusCircleIcon,
    default: CheckCircleIcon,
  }[current]!;

  return (
    <button
      className={cl(
        "flex items-center text-sm rounded-md px-2 bg-white dark:bg-gray-800",
        ["uploading", "modified"].includes(current)
          ? "text-yellow-300"
          : "text-green-300"
      )}
      onClick={() => collab.sync()}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
