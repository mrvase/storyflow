import cl from "clsx";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  FolderIcon,
  MinusCircleIcon,
  MoonIcon,
  PhotoIcon,
  PlusIcon,
  SunIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import Dialog from "../../elements/Dialog";
import { SettingsDialog } from "./SettingsDialog";
import { usePanelActions } from "../../panel-router/PanelRouter";
import { useCollab } from "../../collab/CollabContext";
import { useLocation, useNavigate } from "@storyflow/router";
import { replacePanelPath } from "../../panel-router/utils";
import { DropShadow, Sortable } from "@storyflow/dnd";

export default function Nav() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const [dialog, setDialog] = React.useState<string | null>(null);

  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dark-mode", true);
  const DarkIcon = darkMode ? MoonIcon : SunIcon;

  React.useEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  const actions = usePanelActions();

  const MenuIcon = isOpen ? ChevronLeftIcon : ChevronRightIcon;

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigatePanel = React.useCallback(
    (path: string) => {
      navigate(replacePanelPath(pathname, { path, index: 0 }));
    },
    [pathname, navigate]
  );

  const [toolbarIsOpen, setToolbarIsOpen] = useLocalStorage<boolean>(
    "toolbar-open",
    true
  );

  return (
    <>
      <Dialog
        isOpen={dialog === "settings"}
        close={() => setDialog(null)}
        title="Indstillinger"
      >
        <SettingsDialog close={() => setDialog(null)} />
      </Dialog>
      <div
        className={cl(
          "group h-screen flex flex-col shrink-0 grow-0 overflow-hidden transition-[width] ease-out",
          isOpen ? "w-48" : "w-9 menu-closed",
          "dark:text-white font-medium"
        )}
      >
        <div className="h-full flex flex-col pl-2 py-4 w-48">
          <div className="flex flex-col gap-2">
            <NavButton
              onClick={() => {
                actions.open({ path: "/", index: -1 });
              }}
              icon={PlusIcon}
            >
              Åbn nyt panel
            </NavButton>
            <NavButton
              onClick={() => {
                setToolbarIsOpen((ps) => !ps);
              }}
              icon={toolbarIsOpen ? EditingOffIcon : EditingIcon}
            >
              Slå redigering {toolbarIsOpen ? "fra" : "til"}
            </NavButton>
          </div>
          <div className="lex flex-col gap-1 mt-6">
            <div
              className={cl(
                "text-xs ml-1 font-bold text-gray-500 mb-1 transition-[opacity,height]",
                isOpen ? "opacity-100 h-4" : "opacity-0 h-0"
              )}
            >
              Dine mapper
            </div>
            <NavButton
              onClick={() => {
                navigatePanel("/");
              }}
              icon={FolderIcon}
            >
              Hjem
            </NavButton>
            <Sortable
              type="nav"
              id="nav"
              onChange={() => {}}
              canReceive={{
                link: () => "ignore",
                move: ({ type }) =>
                  type.startsWith("link") ? "accept" : "ignore",
              }}
            >
              <DropShadow>{(item) => <div>{item}</div>}</DropShadow>
            </Sortable>
          </div>
          <div className="w-full grow" onClick={() => setIsOpen((ps) => !ps)} />
          <div className="flex flex-col gap-1">
            <div
              className={cl(
                "text-xs ml-1 font-bold text-gray-500 mb-1 transition-[opacity,height]",
                isOpen ? "opacity-100 h-4" : "opacity-0 h-0"
              )}
            >
              Systemarkiver
            </div>
            <NavButton
              onClick={() => actions.open({ path: "/folders", index: 0 })}
              icon={FolderIcon}
            >
              Mapper
            </NavButton>
            <NavButton
              onClick={() => actions.open({ path: "/templates", index: 0 })}
              icon={DocumentDuplicateIcon}
            >
              Skabeloner
            </NavButton>
            <NavButton
              onClick={() => actions.open({ path: "/files", index: 0 })}
              icon={PhotoIcon}
            >
              Filer
            </NavButton>
            <div className="flex justify-between mt-3">
              <NavButton
                onClick={() => {
                  setIsOpen((ps) => !ps);
                }}
                icon={MenuIcon}
                className="important [.menu-closed_&.important]:opacity-80 [.menu-closed:hover_&.important]:opacity-80"
              />
              <NavButton
                onClick={() => setDarkMode((ps) => !ps)}
                icon={DarkIcon}
              />
              <NavButton icon={UserIcon} onClick={() => {}} />
              <NavButton
                icon={Cog6ToothIcon}
                onClick={() => setDialog("settings")}
              />
              <StatusButton />
            </div>
          </div>
        </div>
        {/*
        <div className="h-full flex flex-col justify-between pl-2 py-2 w-48">
          <div className="mt-auto flex justify-end gap-2">
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => actions.open({ path: "/folders", index: 0 })}
            >
              <FolderIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => actions.open({ path: "/templates", index: 0 })}
            >
              <DocumentIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => actions.open({ path: "/files", index: 0 })}
            >
              <PhotoIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <a
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              href="/bruger"
            >
              <UserIcon className="w-5 h-5" />
            </a>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDarkMode((ps) => !ps)}
            >
              <DarkIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDialog("settings")}
            >
              <CogIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        */}
        {/*<div className="w-full h-11 mt-auto px-3 flex-center font-black tracking-wider text-sm">
          <span className="text-white">Storyflow</span>
        </div>
        */}
      </div>
    </>
  );
}

function NavButton({
  children,
  onClick,
  className,
  icon: Icon,
}: {
  children?: React.ReactNode;
  onClick: () => void;
  className?: string;
  icon: React.ComponentType<{ className: string }>;
}) {
  return (
    <button
      className={cl(
        "w-full h-7 px-1.5 rounded flex gap-2.5 items-center [.menu-closed_&]:opacity-40 [.menu-closed:hover_&]:opacity-75 opacity-75 hover:opacity-100 [.menu-closed:hover_&]:hover:opacity-100 transition-opacity text-sm",
        className
      )}
      onClick={onClick}
    >
      {<Icon className="w-4 h-4" />}
      {children && <div>{children}</div>}
    </button>
  );
}

const EditingOffIcon = ({ className }: { className?: string }) => {
  return <EditingIcon className={className} off />;
};

const EditingIcon = ({
  className,
  off,
}: {
  className?: string;
  off?: boolean;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || "w-6 h-6"}
  >
    <defs>
      <mask id="Mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 5 L19 21"
          stroke="black"
        />
      </mask>
    </defs>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      mask={off ? "url(#Mask)" : undefined}
    />
    {off && (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M1.5 1.5 L22.5 22.5"
      />
    )}
  </svg>
);

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

  const icon = {
    uploading: ArrowUpCircleIcon,
    downloading: ArrowDownCircleIcon,
    modified: MinusCircleIcon,
    default: CheckCircleIcon,
  }[current]!;

  return (
    <NavButton
      icon={icon}
      className={
        ["uploading", "modified"].includes(current)
          ? "text-yellow-400"
          : "text-green-400"
      }
      onClick={() => collab.sync()}
    />
  );
}
