import cl from "clsx";
import { Menu as HeadlessMenu } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { MenuTransition } from "../../elements/transitions/MenuTransition";
import React from "react";

function Menu<T extends { label: string; disabled?: boolean }>({
  as,
  icon,
  label,
  selected,
  onClear,
  align,
  ...props
}: {
  as: any;
  icon: React.FC<{ className: string }>;
  label?: string;
  selected?: T[] | T | null;
  align?: "left" | "right";
  onClear?: () => void;
} & (
  | {
      options: T[];
      onSelect: (value: T) => void;
      multi?: boolean;
    }
  | { children: React.ReactNode }
)) {
  const selectedArray = selected
    ? Array.isArray(selected)
      ? selected
      : [selected]
    : null;

  return (
    <HeadlessMenu>
      {({ open }) => (
        <div className={cl("block text-sm", align === "right" && "relative")}>
          <HeadlessMenu.Button
            as={as}
            active={open}
            data-focus-remain="true"
            selected={Boolean(
              !Array.isArray(selectedArray) || selectedArray.length > 0
            )}
            icon={icon}
          >
            {selectedArray?.map((el) => el.label).join(", ") || label}
          </HeadlessMenu.Button>
          <MenuTransition
            show={open}
            className={cl("absolute z-10", align === "right" && "right-0")}
          >
            <HeadlessMenu.Items
              static
              className="bg-button mt-1 rounded shadow flex flex-col outline-none overflow-hidden w-52 ring-1 ring-gray-600"
              data-focus-remain="true"
            >
              {selected && onClear && (
                <MenuItem onClick={onClear} label="Fjern" />
              )}
              {"children" in props
                ? props.children
                : props.options.map((el) => (
                    <MenuItem
                      key={el.label}
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
            </HeadlessMenu.Items>
          </MenuTransition>
        </div>
      )}
    </HeadlessMenu>
  );
}

const MenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className: string }>;
    label: string;
    disabled?: boolean;
    selected?: boolean;
  }
>(({ label, disabled, selected, icon: Icon, ...props }, ref) => {
  return (
    <HeadlessMenu.Item>
      {({ active }) => (
        <button
          {...props}
          className={cl(
            "py-2 px-2 flex items-center gap-2 text-xs transition-colors",
            active && "rounded bg-gray-700",
            disabled && "text-gray-400",
            props.className
          )}
        >
          {typeof selected === "boolean" && (
            <div
              className={cl(
                "w-3 h-3 flex-center rounded bg-black/10 dark:bg-white/10"
              )}
            >
              {selected ? <CheckIcon className="w-2.5 h-2.5" /> : null}
            </div>
          )}
          {typeof selected !== "boolean" && Icon && (
            <Icon className="w-3 h-3" />
          )}
          <span className="truncate">{label}</span>
        </button>
      )}
    </HeadlessMenu.Item>
  );
});

Menu.Item = MenuItem;

export { Menu };
