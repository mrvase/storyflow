import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "../layout/components/BranchFocusContext";
import {
  ArrowsUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { useLocalStorage } from "../state/useLocalStorage";
import { Menu } from "../elements/Menu";
import { Space, FolderSpace } from "@storyflow/cms/types";
import { useDragItem } from "@storyflow/dnd";
import { useRouteTransition } from "@nanokit/router/routes/nested-transition";
import { Link, usePath, useRoute } from "@nanokit/router";

const spaces: { label: string; item: Omit<Space, "id"> }[] = [
  {
    label: "Mapper",
    item: {
      type: "folders",
      items: [],
    } as Omit<FolderSpace, "id">,
  },
  { label: "Dokumenter", item: { type: "documents" } },
  { label: "Hjemmeside", item: { type: "pages" } },
  {
    label: "Statistik",
    item: {
      type: "folders",
      items: [],
    } as Omit<FolderSpace, "id">,
  },
];

function Content({
  children,
  buttons,
  header,
  toolbar,
  className,
  icon: Icon,
  small,
  hasSidebar,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  buttons?: React.ReactNode;
  toolbar?: React.ReactNode;
  icon?: React.FC<{ className: string }>;
  className?: string;
  small?: boolean;
  hasSidebar?: boolean;
}) {
  const { isFocused } = useBranchIsFocused();

  const route = useRoute();
  const { pathname } = usePath();
  const isSelected = (pathname || "/") === (route.accumulated || "/");

  const status = useRouteTransition();

  return (
    <div
      className={cl(
        "overflow-y-auto overflow-x-hidden no-scrollbar",
        "inset-0 absolute transition-[opacity,transform] duration-200 ease-out",
        "bg-white dark:bg-gray-850", // for when transparency is added on non-focus
        (status.startsWith("exited") && !status.endsWith("replace")) ||
          status.startsWith("unmounted")
          ? "opacity-0 pointer-events-none"
          : "opacity-100",
        (status.startsWith("exited") || status.startsWith("unmounted")) &&
          !status.endsWith("replace")
          ? "translate-x-10"
          : "translate-x-0",
        hasSidebar &&
          "@3xl:ml-64 @3xl:border-l @3xl:border-gray-100 @3xl:dark:border-gray-750",
        !isSelected && !small && "pointer-events-none"
      )}
    >
      {header && (
        <div
          className={cl(
            "sticky h-32 -top-[4.5rem] z-50 border-b border-gray-100 dark:border-gray-750",
            // "bg-gradient-to-b from-gray-850 to-rose-800",
            "bg-white", // need bg color because it is sticky
            "dark:bg-gray-800"
          )}
        >
          <div className={cl("w-full max-w-6xl pt-12 h-32 pb-12 px-5")}>
            <div
              className={cl(
                "flex justify-between",
                isFocused ? "opacity-100" : "opacity-50"
              )}
            >
              <div className="text-2xl flex items-center font-medium">
                <Link
                  to={route.accumulated.split("/").slice(0, -2).join("/")}
                  className={cl(
                    "shrink-0 w-5 h-5 mr-5",
                    small
                      ? "opacity-0"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  )}
                >
                  {route.accumulated !== "/~" && (
                    <ChevronLeftIcon className="w-5 h-5" />
                  )}
                </Link>
                <div
                  className={cl(
                    // "transition-transform ease-out",
                    small ? "-translate-x-9" : "translate-x-0"
                  )}
                >
                  {header}
                </div>
              </div>
              <div
                className={cl(
                  "absolute w-full h-7 translate-y-[2.375rem] text-sm flex items-center",
                  small ? "opacity-0" : "transition-opacity"
                )}
              >
                <ArrangeButton />
                <div className="relative h-7 flex items-center w-full ml-2.5">
                  {toolbar}
                </div>
              </div>
              <div className={cl("flex flex-center translate-y-9")}>
                {buttons}
              </div>
            </div>
            {/*<ToolbarWrapper toolbar={toolbar} isFocused={isFocused} />*/}
          </div>
        </div>
      )}
      {/*!header && toolbar && (
        <div
          className={cl("px-5 py-0", isFocused ? "opacxity-100" : "opacity-50")}
        >
          {toolbar}
        </div>
      )*/}
      <div
        className={cl(
          className ?? "pt-8 min-h-full max-w-6xl",
          small && "@container w-64"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ArrangeButton() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <button
      className={cl(
        "relative",
        "shrink-0 h-7 rounded text-sm transition-all px-2.5",
        isOpen
          ? "mx-0 bg-yellow-400/25 text-yellow-600 dark:text-yellow-200 w-[6.75rem]"
          : "-mx-2.5 w-10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
      )}
      onClick={() => setIsOpen((ps) => !ps)}
    >
      <ArrowsUpDownIcon className="shrink-0 w-5 h-5" />
      <div
        className={cl(
          "absolute top-1 ml-7 pointer-events-none transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      >
        Arranger
      </div>
    </button>
  );
}

const Toolbar = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    secondary?: boolean;
  }
>(({ children, secondary }, ref) => {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);
  let show = secondary ? isOpen : !isOpen;
  return (
    <div
      ref={ref}
      className={cl(
        "absolute w-full flex transition-[transform,opacity] duration-150",
        show ? "opacity-100" : "opacity-0 pointer-events-none",
        secondary
          ? "[&_.active]:text-yellow-600 [&_.active]:dark:text-yellow-200 child:text-yellow-600/75 child:dark:text-yellow-200/75 hover:child:text-yellow-600 dark:hover:child:text-yellow-200"
          : "[&_.active]:text-gray-800 [&_.active]:dark:text-white child:text-gray-600 child:dark:text-gray-400 hover:child:text-gray-800 dark:hover:child:text-white"
      )}
    >
      {children}
    </div>
  );
});

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
  }
>(({ icon: Icon, active, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "group h-7 flex-center gap-2 transition-colors rounded px-2.5 font-medium",
        active && "active",
        props.className
      )}
    >
      {Icon && (
        <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
      )}
      <span className={Icon ? "hidden @lg:block" : ""}>{props.children}</span>
      {active ? (
        <ChevronUpIcon className="w-3 h-3" />
      ) : (
        <ChevronDownIcon className="w-3 h-3" />
      )}
    </button>
  );
});

function ToolbarDragButton({
  item,
  label,
  type,
  id,
  icon,
}: {
  label: string;
  item: any;
  id: string;
  type: string;
  icon: React.FC<{ className?: string }>;
}) {
  const { ref, dragHandleProps, state } = useDragItem({
    id,
    type,
    item,
    mode: "move",
  });

  return (
    <ToolbarButton
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      icon={icon}
      className="cursor-grab"
    >
      {label}
    </ToolbarButton>
  );
}

export default Object.assign(Content, {
  Toolbar,
  ToolbarButton,
  ToolbarDragButton,
});
