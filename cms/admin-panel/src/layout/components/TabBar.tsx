import React from "react";
import {
  PlusIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  MinusCircleIcon,
  ArrowDownCircleIcon,
  Bars3Icon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import cl from "clsx";
import { useLocalStorage } from "../../state/useLocalStorage";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { CommandLine } from "./CommandLine";
import { usePanelActions } from "../../panel-router/PanelRouter";

export default function TabBar() {
  const actions = usePanelActions();

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
      className={cl(
        "bottom-1 z-10 w-full absolute h-10 flex px-3 gap-2",
        "text-gray-600 dark:text-gray-200"
      )}
    >
      <div
        className="transition-[opacity,width,margin-right]"
        style={
          navIsOpen
            ? {
                width: "0rem",
                marginRight: "-0.5rem",
                opacity: 0,
                pointerEvents: "none",
              }
            : { width: "2.5rem", marginRight: "0rem", opacity: 1 }
        }
      >
        <div className={cl("h-8 w-8 border-4 border-gray-850 rounded-lg")}>
          <button
            className={cl(
              "h-6 w-6 flex-center rounded-md transition-[color,box-shadow]",
              "bg-button text-button ring-button"
            )}
            onClick={() => setNavIsOpen((ps) => !ps)}
          >
            {navIsOpen ? (
              <ChevronLeftIcon className="w-4 h-4" />
            ) : (
              <Bars3Icon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      <div
        className={cl("h-8 w-8 border-4 border-gray-850 rounded-lg", "ml-auto")}
      >
        <button
          className={cl(
            "text-sm h-6 w-6 shrink-0 flex-center rounded-md transition-[color,box-shadow]",
            "bg-button ring-button text-button"
          )}
          onClick={() => setSidebarIsOpen((ps) => !ps)}
        >
          <StatusButton />
        </button>
      </div>
    </div>
  );
}

export function StatusButton() {
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

  const collab = useDocumentCollab();

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
    <div
      className={cl(
        "h-4 w-4",
        ["uploading", "modified"].includes(current)
          ? "text-yellow-400"
          : "text-green-400"
      )}
      onClick={() => collab.sync()}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}
