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
  ArrowsUpDownIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/solid";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import { collab } from "../../collab/CollabContext";
import { Link, useLocation, useNavigate } from "@nanokit/router";
import { DropShadow, Sortable } from "@storyflow/dnd";
import { actions } from "../../pages/routes";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { navigateFocusedPanel } from "../../custom-events";
import { useOrganization } from "../../clients/auth";
import { useFolder } from "../../folders/FoldersContext";
import { DocumentId, FolderId } from "@storyflow/shared/types";
import { getFolderData } from "../../folders/getFolderData";
import { shortenUrlId } from "../../utils/shortenUrlId";

export const useNav = () => {
  const { slug } = useOrganization()!;
  return useLocalStorage<
    ({ type: "document"; id: DocumentId } | { type: "folder"; id: FolderId })[]
  >(`${slug}:nav`, []);
};

const navigateProps = (pathname: string, to: string) => {
  if (pathname.indexOf("/~") < 0) {
    return {
      onClick() {
        actions.open({
          path: to,
          index: 0,
        });
      },
    };
  }
  return {
    to,
  };
};

export default function Nav() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const [dialog, setDialog] = React.useState<string | null>(null);

  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dark-mode", true);
  const DarkIcon = darkMode ? MoonIcon : SunIcon;

  const MenuIcon = isOpen ? ChevronLeftIcon : ChevronRightIcon;

  const { pathname } = useLocation();

  const [nav, setNav] = useNav();

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
          "h-screen flex flex-col shrink-0 grow-0 overflow-hidden ease-out",
          isOpen ? "w-60" : "w-10 menu-closed",
          "dark:text-white text-sm font-medium"
        )}
      >
        <div className="h-full flex flex-col pl-2 w-60">
          <div className="flex flex-col border-b border-gray-200 dark:border-gray-800 pt-8 pb-6">
            <NavButton
              onClick={() => {
                actions.open({ path: "/~", index: 0 });
              }}
              icon={PlusIcon}
            >
              Åbn panel
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
          <div className="flex flex-col py-6">
            {/*<div
              className={cl(
                "text-xs ml-1 font-bold text-gray-500 mb-1 transition-[opacity,height]",
                isOpen ? "opacity-100 h-4" : "opacity-0 h-0"
              )}
            >
              Dine mapper
            </div>*/}
            <NavButton {...navigateProps(pathname, "/~")} icon={FolderIcon}>
              Hjem
            </NavButton>
            {nav.map((item) => (
              <CustomNavButton key={item.id} item={item} />
            ))}
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
          <div
            className="w-full grow border-b border-gray-200 dark:border-gray-800"
            onClick={() => setIsOpen((ps) => !ps)}
          />
          <div className="flex flex-col py-3 border-b border-gray-200 dark:border-gray-800">
            {/*<NavButton {...navigateProps("/~/folders")} icon={FolderIcon}>
              Mapper
            </NavButton>*/}
            <NavButton
              {...navigateProps(
                pathname,
                `/~/f/${shortenUrlId(TEMPLATE_FOLDER)}`
              )}
              icon={DocumentDuplicateIcon}
            >
              Skabeloner
            </NavButton>
            <NavButton
              {...navigateProps(pathname, "/~/files")}
              icon={PhotoIcon}
            >
              Filer
            </NavButton>
          </div>
          <div className="py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex justify-between gap-8">
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
          <div className="pt-3 pb-3.5">
            <ArrangeButton />
          </div>
        </div>
      </div>
    </>
  );
}

function CustomNavButton({
  item,
}: {
  item: { type: "document"; id: DocumentId } | { type: "folder"; id: FolderId };
}) {
  const { pathname } = useLocation();

  let label = "Ingen label";
  let Icon = FolderIcon;

  if (item.type === "folder") {
    const folder = useFolder(item.id);
    label = folder?.label ?? label;
    Icon =
      folder && getFolderData(folder).type === "app"
        ? ComputerDesktopIcon
        : Icon;
  }

  return (
    <NavButton
      {...navigateProps(
        pathname,
        `/~/${item.type === "document" ? "d" : "f"}/${parseInt(
          item.id,
          16
        ).toString(16)}`
      )}
      icon={Icon}
    >
      {label}
    </NavButton>
  );
}

function ArrangeButton() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <NavButton onClick={() => setIsOpen((ps) => !ps)} icon={ArrowsUpDownIcon}>
      Arranger
    </NavButton>
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
  icon: React.ComponentType<{ onMouseDown?: any; className?: string }>;
} & (
  | {
      onClick: () => void;
    }
  | {
      to: string;
    }
)) {
  const classNameFull = cl(
    "group w-full h-9 px-1.5 rounded flex gap-4 items-center text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white [.menu-closed:hover_&]:hover:text-white transition-colors",
    className
  );

  const content = (
    <>
      <Icon className="shrink-0 w-5 h-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
      {children && <div>{children}</div>}
    </>
  );

  if ("to" in action) {
    return (
      <Link
        to={action.to}
        className={classNameFull}
        data-focus-remain="true"
        onClick={(ev) => {
          if (
            action.to.indexOf("/~") >= 0 &&
            !ev.metaKey &&
            !ev.ctrlKey &&
            !ev.shiftKey
          ) {
            ev.preventDefault();
            navigateFocusedPanel.dispatch(action.to);
          }
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button className={classNameFull} {...action}>
      {content}
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
      onClick={() => collab.sync()}
    />
  );
}
