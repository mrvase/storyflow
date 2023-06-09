import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "../layout/components/BranchFocusContext";
import {
  ArrowsUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { useLocalStorage } from "../state/useLocalStorage";
import { Menu } from "../elements/Menu";
import { Space, FolderSpace } from "@storyflow/cms/types";
import { useDragItem } from "@storyflow/dnd";
import { useRouteTransition } from "@nanokit/router/routes/nested-transition";
import { usePath, useRoute } from "@nanokit/router";

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
        "bg-white dark:bg-gray-850 text-gray-700 dark:text-white", // for when transparency is added on non-focus
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
            "sticky -top-16 z-50 border-b border-gray-100 dark:border-gray-750",
            "bg-white", // need bg color because it is sticky
            "bg-gradient-to-b dark:from-gray-800 dark:to-[#1b2533]"
            // "bg-gradient-to-b from-gray-850 to-rose-800",
          )}
        >
          <div className={cl("w-full max-w-6xl pt-[4.5rem] pb-12 px-5")}>
            <div
              className={cl(
                "flex justify-between",
                isFocused ? "opacity-100" : "opacity-50"
              )}
            >
              <div className="text-gray-800 dark:text-white text-3xl flex-center font-medium">
                <div
                  className={cl(
                    "shrink-0 w-4 h-4 mr-5",
                    small ? "opacity-0" : "opacity-75"
                  )}
                >
                  {Icon && <Icon className="w-5 h-5 -ml-0.5" />}
                </div>
                <div
                  className={cl(
                    "h-9",
                    // "transition-transform ease-out",
                    small ? "-translate-x-9" : "translate-x-0"
                  )}
                >
                  {header}
                </div>
              </div>
              <div
                className={cl(
                  "absolute w-full h-7 translate-y-[2.675rem] text-sm flex items-center",
                  small ? "opacity-0" : "transition-opacity"
                )}
              >
                <ArrangeButton />
                <div className="relative h-7 flex items-center w-full ml-2.5">
                  {toolbar}
                </div>
              </div>
              <div className={cl("flex flex-center")}>{buttons}</div>
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
          className ?? "pt-6 min-h-full max-w-6xl",
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
          ? "mx-0 bg-yellow-400/25 text-yellow-600 dark:text-yellow-200 w-[6.5rem]"
          : "-mx-2.5 w-9 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
      )}
      onClick={() => setIsOpen((ps) => !ps)}
    >
      <ArrowsUpDownIcon className="shrink-0 w-4 h-4" />
      <div
        className={cl(
          "absolute top-1 ml-[1.625rem] pointer-events-none transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
      >
        Arranger
      </div>
    </button>
  );
}

/*
function ToolbarWrapper({
  toolbar,
  isFocused,
}: {
  toolbar?: React.ReactNode;
  isFocused?: boolean;
}) {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <>
      {isOpen && (
        <div
          className={cl(
            "flex items-center max-w-6xl mt-4 -mb-5",
            isFocused ? "opacity-100" : "opacity-50"
          )}
        >
          <div
            className="w-4 mr-4 opacity-25 hover:opacity-100 transition-opacity"
            onClick={() => setIsOpen(false)}
          >
            <ChevronUpIcon className="w-4 h-4" />
          </div>
          <div>{toolbar}</div>
        </div>
      )}
    </>
  );
}
*/

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
        "absolute w-full flex transition-[transform,opacity] child:text-gray-500 duration-150",
        show ? "opacity-100" : "opacity-0 pointer-events-none",
        secondary
          ? "[&_.active]:text-yellow-600 [&_.active]:dark:text-yellow-200 child:text-yellow-600/75 child:dark:text-yellow-200/75 hover:child:text-yellow-600 dark:hover:child:text-yellow-200"
          : "[&_.active]:text-gray-800 [&_.active]:dark:text-white child:text-gray-500 hover:child:text-gray-800 dark:hover:child:text-white"
      )}
    >
      {children}
    </div>
  );
});

/*
const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className: string }>;
    active?: boolean;
    selected?: boolean;
  }
>(({ icon: Icon, active, selected, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "ring-button flex-center gap-1.5 text-xs h-7 px-2.5 rounded whitespace-nowrap",
        active ? "bg-button-active" : "bg-button",
        selected === false
          ? "text-gray-800 dark:text-white text-opacity-50 dark:text-opacity-50"
          : "text-button",
        active &&
          "text-opacity-100 dark:text-opacity-100 ring-gray-600 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span className={Icon ? "hidden @lg:block" : ""}>{props.children}</span>
      {typeof selected === "boolean" &&
        (active ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        ))}
    </button>
  );
});
*/

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
    selected?: boolean;
  }
>(({ icon: Icon, active, selected, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "h-7 flex-center gap-2 transition-colors rounded px-2.5",
        active && "active",
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span className={Icon ? "hidden @lg:block" : ""}>{props.children}</span>
      {typeof selected === "boolean" &&
        (active ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        ))}
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

function Test() {
  return (
    <Menu as={ToolbarButton} label="Tilføj space" icon={StopIcon}>
      {spaces.map((el) => (
        <Menu.DragItem
          key={el.label}
          type="spaces"
          id={`nyt-space-${el.label}`}
          onClick={() => {}}
          {...el}
        />
      ))}
    </Menu>
  );
}
