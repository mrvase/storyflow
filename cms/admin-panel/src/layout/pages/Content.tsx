import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "../components/BranchFocusContext";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { useLocalStorage } from "../../state/useLocalStorage";
import {
  usePanel,
  useRoute,
  useRouteTransition,
} from "../../panel-router/Routes";

function Content({
  children,
  buttons,
  header,
  toolbar,
  className,
  icon: Icon,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  buttons?: React.ReactNode;
  toolbar?: React.ReactNode;
  icon?: React.FC<{ className: string }>;
  className?: string;
}) {
  const { isFocused } = useBranchIsFocused();

  const route = useRoute();
  const [{ path }] = usePanel();
  const isSelected = (path || "/") === (route || "/");

  const [, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

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
        !isSelected && "pointer-events-none"
      )}
    >
      {header && (
        <div
          className={cl(
            "pt-12 pb-5 px-5 mb-6 sticky -top-10 z-50 border-b border-gray-100 dark:border-gray-800 max-w-6xl",
            "bg-white dark:bg-gray-850" // need bg color because it is sticky
            // isFocused ? "dark:bg-gray-850" : "dark:bg-gray-900"
            // "bg-gradient-to-b from-gray-850 to-rose-800"
          )}
        >
          <div
            className={cl(
              "flex justify-between",
              isFocused ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="text-gray-800 dark:text-white text-2xl leading-none flex-center font-medium">
              <div className="text-sm w-4 mt-0.5 mr-5">
                {Icon && (
                  <div
                    onClick={() => setIsOpen((ps) => !ps)}
                    data-focus-remain="true"
                    className={
                      "opacity-25 hover:opacity-100 transition-opacity"
                    }
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                )}
              </div>
              {header}
            </div>
            <div className="flex flex-center">{buttons}</div>
          </div>
          <ToolbarWrapper toolbar={toolbar} isFocused={isFocused} />
        </div>
      )}
      {!header && toolbar && (
        <div
          className={cl("px-5 py-0", isFocused ? "opacxity-100" : "opacity-50")}
        >
          {toolbar}
        </div>
      )}
      <div className={cl(className ?? "max-w-6xl")}>{children}</div>
    </div>
  );
}

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
            "flex items-center max-w-6xl mt-4",
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

const Toolbar = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex p-1 gap-2 overflow-x-auto no-scrollbar">
      {children}
    </div>
  );
};

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
        "ring-button flex-center gap-1.5 text-xs h-6 px-2 rounded whitespace-nowrap",
        active ? "bg-button-active" : "bg-button",
        selected === false
          ? "text-gray-800 dark:text-white text-opacity-50 dark:text-opacity-50"
          : "text-button",
        active &&
          "text-opacity-100 dark:text-opacity-100 ring-gray-600 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
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

export default Object.assign(Content, {
  Toolbar,
  ToolbarButton,
});
