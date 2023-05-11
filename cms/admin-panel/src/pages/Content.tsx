import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "../layout/components/BranchFocusContext";
import {
  ArrowsPointingOutIcon,
  ArrowsUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ComputerDesktopIcon,
  DocumentDuplicateIcon,
  StopIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useLocalStorage } from "../state/useLocalStorage";
import {
  usePanel,
  useRoute,
  useRouteTransition,
} from "../layout/panel-router/Routes";

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

  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

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
            "mb-6 sticky -top-16 z-50 border-b border-gray-100 dark:border-gray-800",
            "bg-white", // need bg color because it is sticky
            "bg-gradient-to-b dark:from-gray-800 dark:to-[#1b2533]"
            // "bg-gradient-to-b from-gray-850 to-rose-800"
          )}
        >
          <div className="w-full max-w-6xl pt-[4.5rem] pb-12 px-5">
            <div
              className={cl(
                "flex justify-between",
                isFocused ? "opacity-100" : "opacity-50"
              )}
            >
              <div className="text-gray-800 dark:text-white text-3xl flex-center font-medium">
                <div className="opacity-75 w-4 mt-0.5 mr-5">
                  {Icon && <Icon className="w-5 h-5 -ml-0.5" />}
                </div>
                {header}
              </div>
              <div className="absolute w-full h-7 translate-y-11 text-sm flex items-center">
                <button
                  className={cl(
                    "relative",
                    "shrink-0 h-7 rounded text-sm transition-all px-2.5",
                    isOpen
                      ? "mx-0 bg-yellow-400/25 text-yellow-200 w-[6.5rem]"
                      : "-mx-2.5 w-9 text-gray-500 hover:text-gray-200"
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
                <div className="relative h-7 flex items-center w-full ml-5">
                  <div
                    className={cl(
                      "absolute w-full flex gap-5 transition-[transform,opacity]",
                      !isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                  >
                    <button className="flex-center gap-2 text-gray-500 hover:text-gray-200 transition-colors">
                      <DocumentDuplicateIcon className="w-4 h-4" />
                      Person
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <button className="flex-center gap-2 text-gray-500 hover:text-gray-200 transition-colors">
                      <ComputerDesktopIcon className="w-4 h-4" />
                      Domæner
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div
                    className={cl(
                      "absolute w-full flex gap-5 transition-[transform,opacity]",
                      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                  >
                    <button className="flex-center gap-2 text-gray-400 hover:text-gray-200 transition-colors">
                      <StopIcon className="w-4 h-4" />
                      Tilføj space
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className={cl("flex flex-center")}>{buttons}</div>
            </div>
            {/*<ToolbarWrapper toolbar={toolbar} isFocused={isFocused} />*/}
          </div>
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

export default Object.assign(Content, {
  Toolbar,
  ToolbarButton,
});
