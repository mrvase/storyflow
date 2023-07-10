import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "../layout/components/BranchFocusContext";
import {
  ArrowsUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  StopIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLocalStorage } from "../state/useLocalStorage";
import { Menu } from "../elements/Menu";
import { Space, FolderSpace } from "@storyflow/cms/types";
import { useDragItem } from "@storyflow/dnd";
import { useRouteTransition } from "@nanokit/router/routes/nested-transition";
import { Link, usePath, useRoute } from "@nanokit/router";
import { ToolbarPortal } from "../layout/components/LocationBar";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "../elements/ErrorFallback";

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

function useIsCurrentPage() {
  const route = useRoute();
  const { pathname } = usePath();
  return (pathname || "/") === (route.accumulated || "/");
}

function Content({
  children,
  className,
  icon: Icon,
  small,
  hasSidebar,
}: {
  children: React.ReactNode;
  icon?: React.FC<{ className: string }>;
  className?: string;
  small?: boolean;
  hasSidebar?: boolean;
}) {
  const status = useRouteTransition();

  const isCurrentPage = useIsCurrentPage();

  return (
    <div
      className={cl(
        "overflow-y-auto overflow-x-hidden no-scrollbar",
        "inset-0 absolute transition-[opacity,transform] duration-200 ease-out",
        "bg-white dark:bg-gray-900", // for when transparency is added on non-focus
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
        !isCurrentPage && "pointer-events-none",
        small && "@3xl:pointer-events-auto"
      )}
    >
      <div
        className={cl(
          className ?? "min-h-full max-w-6xl",
          small && "@container @3xl:w-64"
        )}
      >
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}

const Header = ({ children }: { children: React.ReactNode }) => {
  const { isFocused } = useBranchIsFocused();

  return (
    <div
      className={cl(
        "ml-5 @sm:ml-[3.75rem] h-24 py-8 flex items-center justify-between",
        !isFocused && "opacity-50"
      )}
    >
      {children}
    </div>
  );
};

const Toolbar = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
  }
>(({ children }, ref) => {
  return (
    <div ref={ref} className={cl("hidden @sm:flex gap-5 pr-5")}>
      {children}
    </div>
  );
});

const SecondaryToolbar = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);
  return (
    <>
      <div
        className={cl(
          "flex gap-5 py-2.5 px-5 sticky z-30 bottom-0 transition-opacity bg-white dark:bg-gray-900",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="self-center" onClick={() => setIsOpen(false)}>
          <XMarkIcon className="w-5 h-5 text-gray-600/75 dark:text-gray-200/50" />
        </div>
        {children}
      </div>
    </>
  );
};

/*
function ArrangeButton() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <button
      className={cl(
        "relative overflow-hidden",
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
*/

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
    secondary?: boolean;
    menu?: boolean;
    dimmed?: boolean;
  }
>(({ icon: Icon, active, secondary, menu, dimmed, ...props }, ref) => {
  /*
  secondary
    ? active
      ? "text-yellow-600 dark:text-yellow-200"
      : "text-yellow-600/75 dark:text-yellow-200/75 hover:text-yellow-600 dark:hover:text-yellow-200"
    : */
  /*
  ICON
  secondary
              ? "text-yellow-600/60 group-hover:text-yellow-600 dark:text-yellow-200/50 dark:group-hover:text-yellow-200"
              : 
  */
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "group h-7 flex-center gap-2 transition-colors rounded font-medium text-sm",
        active
          ? "text-gray-800 dark:text-white"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white",
        props.className
      )}
    >
      {Icon && (
        <Icon
          className={cl(
            "w-5 h-5 transition-colors",
            "text-gray-400 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
          )}
        />
      )}
      <span
        className={cl(
          Icon ? "hidden @lg:block" : "",
          dimmed && !active && "opacity-75"
        )}
      >
        {props.children}
      </span>
      {menu &&
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
  secondary,
}: {
  label: string;
  item: any;
  id: string;
  type: string;
  icon: React.FC<{ className?: string }>;
  secondary?: boolean;
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
      secondary={secondary}
      className="cursor-grab"
    >
      {label}
    </ToolbarButton>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen pb-96">{children}</div>;
}

export default Object.assign(Content, {
  Header,
  Body,
  Toolbar,
  SecondaryToolbar,
  ToolbarButton,
  ToolbarDragButton,
});
