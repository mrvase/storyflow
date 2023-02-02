import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "./Branch";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";

const VariantContext = React.createContext<string>("default");
const useVariant = () => React.useContext(VariantContext);

function Content({
  children,
  selected,
  buttons,
  header,
  toolbar,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  selected: boolean;
  header?: React.ReactNode;
  buttons?: React.ReactNode;
  toolbar?: React.ReactNode;
  variant?: string;
  className?: string;
}) {
  const { isFocused } = useBranchIsFocused();

  /*
  const colors = {
    default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-white",
    template: "bg-teal-200 text-teal-700 dark:bg-teal-800 dark:text-white",
    app: "bg-yellow-200 text-yellow-700 dark:bg-yellow-800 dark:text-white",
  }[variant];
  */

  return (
    <VariantContext.Provider value={variant}>
      <div
        className={cl(
          "inset-0 absolute transition-[opacity,transform] ease-out overflow-y-auto no-scrollbar",
          "bg-white dark:bg-gray-850 text-gray-700 dark:text-white", // for when transparency is added on non-focus
          selected
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-10 pointer-events-none"
        )}
      >
        {header && (
          <div
            className={cl(
              "pt-12 pb-6 px-5 mb-6 sticky -top-10 bg-gray-850 z-50 border-b border-white/5"
              // "bg-gradient-to-b from-gray-850 to-rose-800"
            )}
          >
            <div
              className={cl(
                "flex justify-between max-w-6xl",
                isFocused ? "opacity-100" : "opacity-25"
              )}
            >
              <div className="text-gray-800 text-2xl dark:text-white">
                {header}
              </div>
              {buttons}
            </div>
            <div className={isFocused ? "opacity-100" : "opacity-25"}>
              {toolbar}
            </div>
          </div>
        )}
        {!header && toolbar && (
          <div
            className={cl(
              "px-5 py-0",
              isFocused ? "opacity-100" : "opacity-25"
            )}
          >
            {toolbar}
          </div>
        )}
        <div className={cl(className ?? "max-w-6xl")}>{children}</div>
      </div>
    </VariantContext.Provider>
  );
}

const Toolbar = ({ children }: { children: React.ReactNode }) => {
  return <div className="max-w-6xl mt-5 flex gap-2">{children}</div>;
};

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className: string }>;
    active?: boolean;
    chevron?: boolean;
  }
>(({ icon: Icon, active, chevron, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "flex-center gap-1.5 text-xs font-light py-1 px-2 rounded text-white/80 transition-colors",
        active ? "bg-white/20" : "bg-white/10 hover:bg-white/20",
        props.className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {props.children}
      {chevron &&
        (active ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        ))}
    </button>
  );
});

function ToolbarMenu<T extends { label: string }>({
  icon,
  label,
  selected,
  options,
  onSelect,
  onClear,
}: {
  icon: React.FC<{ className: string }>;
  label: string;
  selected?: T | null;
  options: T[];
  onSelect: (value: T) => void;
  onClear?: () => void;
}) {
  return (
    <Menu>
      {({ open }) => (
        <div className="block">
          <Menu.Button
            as={ToolbarButton}
            active={open}
            data-focus-remain="true"
            chevron
            icon={icon}
            className={cl(!selected && "text-white/50")}
          >
            {selected?.label ?? label}
          </Menu.Button>
          <MenuTransition show={open} className="absolute z-10">
            <Menu.Items
              static
              className="bg-white dark:bg-gray-800 mt-1 rounded shadow flex flex-col outline-none overflow-hidden w-52"
              data-focus-remain="true"
            >
              {selected && onClear && (
                <Menu.Item>
                  {({ active }) => (
                    <div
                      className={cl(
                        "py-1.5 px-3 hover:bg-gray-700 font-light",
                        active && "bg-teal-700"
                      )}
                      onClick={onClear}
                    >
                      Fjern
                    </div>
                  )}
                </Menu.Item>
              )}
              {options.map((el) => (
                <Menu.Item>
                  {({ active }) => (
                    <div
                      className={cl(
                        "py-1.5 px-3 hover:bg-gray-700 font-light",
                        active && "bg-teal-700"
                      )}
                      onClick={() => {
                        onSelect(el);
                      }}
                    >
                      {el.label}
                    </div>
                  )}
                </Menu.Item>
              ))}
            </Menu.Items>
          </MenuTransition>
        </div>
      )}
    </Menu>
  );
}

const Header = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const Buttons = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex gap-1.5 text-gray-600 dark:text-white">{children}</div>
  );
};

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className: string }>;
    active?: boolean;
  }
>(({ icon: Icon, active, ...props }, ref) => {
  const variant = useVariant();

  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "flex-center rounded-md h-8 px-3 transition-colors text-sm hover:shadow-sm outline-0 outline focus-visible:outline-2 outline-offset-2 outline-teal-600",
        Icon &&
          cl(
            "hover:bg-teal-100 dark:hover:bg-teal-600 hover:text-teal-600 dark:hover:text-teal-100 hover:shadow-teal-500/20",
            active &&
              "bg-teal-100 text-teal-600 dark:bg-teal-600 dark:text-teal-100"
          ),
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {props.children}
    </button>
  );
});

export default Object.assign(Content, {
  Header,
  Buttons,
  Button,
  Toolbar,
  ToolbarButton,
  ToolbarMenu,
});
