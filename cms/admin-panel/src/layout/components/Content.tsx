import React from "react";
import cl from "clsx";
import { useBranchIsFocused } from "./Branch";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";

function Content({
  children,
  selected,
  buttons,
  header,
  toolbar,
  className,
}: {
  children: React.ReactNode;
  selected: boolean;
  header?: React.ReactNode;
  buttons?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
}) {
  const { isFocused } = useBranchIsFocused();

  return (
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
            "pt-12 pb-5 px-5 mb-6 sticky -top-10 z-50 border-b border-gray-100 dark:border-gray-800",
            "bg-white dark:bg-gray-850" // need bg color because it is sticky
            // isFocused ? "dark:bg-gray-850" : "dark:bg-gray-900"
            // "bg-gradient-to-b from-gray-850 to-rose-800"
          )}
        >
          <div
            className={cl(
              "flex justify-between max-w-6xl",
              isFocused ? "opacity-100" : "opacity-50"
            )}
          >
            <div className="text-gray-800 text-2xl leading-none dark:text-white">
              {header}
            </div>
            {buttons}
          </div>
          <div className={isFocused ? "opacity-100" : "opacity-50"}>
            {toolbar}
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

const Toolbar = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="max-w-6xl py-1 mt-4 flex gap-2 pl-9 overflow-x-auto no-scrollbar">
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
        "ring-button flex-center gap-1.5 text-xs font-light py-1 px-2 rounded whitespace-nowrap",
        active ? "bg-button-active" : "bg-button",
        selected === false
          ? "text-gray-800 dark:text-white text-opacity-50 dark:text-opacity-50"
          : "text-button",
        props.className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {props.children}
      {typeof selected === "boolean" &&
        (active ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        ))}
    </button>
  );
});

function ToolbarMenu<T extends { label: string; disabled?: boolean }>({
  icon,
  label,
  selected,
  onClear,
  ...props
}: {
  icon: React.FC<{ className: string }>;
  label: string;
  selected?: T[] | T | null;
  onClear?: () => void;
} & (
  | {
      options: T[];
      onSelect: (value: T) => void;
      multi?: boolean;
    }
  | { children: React.ReactElement[] }
)) {
  const selectedArray = selected
    ? Array.isArray(selected)
      ? selected
      : [selected]
    : null;

  return (
    <Menu>
      {({ open }) => (
        <div className="block text-sm font-light">
          <Menu.Button
            as={ToolbarButton}
            active={open}
            data-focus-remain="true"
            selected={Boolean(selectedArray && selectedArray.length > 0)}
            icon={icon}
          >
            {selectedArray?.map((el) => el.label).join(", ") || label}
          </Menu.Button>
          <MenuTransition show={open} className="absolute z-10">
            <Menu.Items
              static
              className="bg-button mt-1 rounded shadow flex flex-col outline-none overflow-hidden w-52 ring-1 ring-inset ring-white/10"
              data-focus-remain="true"
            >
              {selected && onClear && (
                <ToolbarMenuOption onClick={onClear} label="Fjern" />
              )}
              {"children" in props
                ? props.children
                : props.options.map((el) => (
                    <ToolbarMenuOption
                      disabled={el.disabled}
                      selected={
                        props.multi
                          ? selectedArray?.some((s) => s === el)
                          : undefined
                      }
                      onClick={(ev) => {
                        if (props.multi || el.disabled) ev.preventDefault();
                        if (!el.disabled) props.onSelect(el);
                      }}
                      label={el.label}
                    />
                  ))}
            </Menu.Items>
          </MenuTransition>
        </div>
      )}
    </Menu>
  );
}

const ToolbarMenuOption = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className: string }>;
    label: string;
    disabled?: boolean;
    selected?: boolean;
  }
>(({ label, disabled, selected, ...props }, ref) => {
  return (
    <Menu.Item>
      {({ active }) => (
        <button
          {...props}
          className={cl(
            "py-1.5 px-2 font-light flex items-center gap-2 text-sm",
            active && "rounded ring-1 ring-inset ring-white/10",
            disabled && "text-gray-500",
            props.className
          )}
        >
          {typeof selected === "boolean" && (
            <div className="w-4 h-4 flex-center rounded bg-gray-700">
              {selected ? <CheckIcon className="w-3 h-3" /> : null}
            </div>
          )}
          <span className="truncate">{label}</span>
        </button>
      )}
    </Menu.Item>
  );
});

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
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "flex-center rounded-md h-7 px-3 text-sm outline-0 outline focus-visible:outline-2 outline-offset-2 outline-teal-600 transition-shadow",
        Icon && cl("hover:ring-1 ring-inset ring-gray-200 dark:ring-gray-700"),
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
  ToolbarMenuOption,
});
