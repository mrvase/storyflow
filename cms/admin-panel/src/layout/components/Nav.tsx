import cl from "clsx";
import {
  ArrowDownCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
import { usePanelActions } from "../panel-router/PanelRouter";
import { useCollab } from "../../collab/CollabContext";
import { Link, useLocation, useNavigate } from "@storyflow/router";
import { replacePanelPath } from "../panel-router/utils";
import { DropShadow, Sortable } from "@storyflow/dnd";

export default function Nav() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const [dialog, setDialog] = React.useState<string | null>(null);

  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dark-mode", true);
  const DarkIcon = darkMode ? MoonIcon : SunIcon;

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
      {/*
      <Dialog
        isOpen={dialog === "settings"}
        close={() => setDialog(null)}
        title="Indstillinger"
      >
        <SettingsDialog close={() => setDialog(null)} />
      </Dialog>
      */}
      <div
        className={cl(
          "group h-screen flex flex-col shrink-0 grow-0 overflow-hidden transition-[width] ease-out",
          isOpen ? "w-60" : "w-10 menu-closed",
          "dark:text-white"
        )}
      >
        <div className="h-full flex flex-col pl-2 py-4 w-48">
          <div className="flex flex-col gap-2">
            <NavButton
              onClick={() => {
                actions.open({ path: "/", index: 0 });
              }}
              icon={PlusIcon}
            >
              Åbn nyt panel
            </NavButton>
            {/*<NavButton
              onClick={() => {
                setToolbarIsOpen((ps) => !ps);
              }}
              icon={toolbarIsOpen ? EditingOffIcon : EditingIcon}
            >
              Slå redigering {toolbarIsOpen ? "fra" : "til"}
            </NavButton>*/}
          </div>
          <div className="lex flex-col gap-1 mt-6">
            {/*<div
              className={cl(
                "text-xs ml-1 font-bold text-gray-500 mb-1 transition-[opacity,height]",
                isOpen ? "opacity-100 h-4" : "opacity-0 h-0"
              )}
            >
              Dine mapper
            </div>*/}
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
              <NavButton icon={ArrowRightOnRectangleIcon} to="/" />
              <NavButton
                onClick={() => setDarkMode((ps) => !ps)}
                icon={DarkIcon}
              />
              <StatusButton />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function NavButton({
  children,
  className,
  icon: Icon,
  ...action
}: {
  children?: React.ReactNode;
  className?: string;
  icon: React.ComponentType<{ className: string }>;
} & (
  | {
      onClick: () => void;
    }
  | {
      to: string;
    }
)) {
  const Component = "to" in action ? Link : "button";

  return (
    <Component
      className={cl(
        "w-full h-7 px-1.5 rounded flex gap-4 items-center [.menu-closed_&]:opacity-40 [.menu-closed:hover_&]:opacity-75 opacity-75 hover:opacity-100 [.menu-closed:hover_&]:hover:opacity-100 transition-opacity",
        className
      )}
      {...(action as any)}
    >
      {<Icon className="w-5 h-5" />}
      {children && <div>{children}</div>}
    </Component>
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

  /*
  React.useEffect(() => {
    return collab.registerMutationListener(() => {
      changeState({
        isModified: true,
      });
    });
  }, [isModified, collabState]);
  */

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
      onClick={() => collab.sync(0)}
    />
  );
}
