import cl from "clsx";
import { Menu as HeadlessMenu } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { MenuTransition } from "./transitions/MenuTransition";
import React from "react";
import { useDragItem } from "@storyflow/dnd";

function Menu<T extends { label: string; disabled?: boolean }>({
  as,
  icon,
  label,
  selected,
  onClear,
  align,
  small,
  ...props
}: {
  as: any;
  icon: React.FC<{ className: string }>;
  label?: string;
  selected?: T[] | T | null;
  align?: "left" | "right";
  onClear?: () => void;
  small?: boolean;
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
          <MenuItems open={open} align={align} small={small}>
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
          </MenuItems>
        </div>
      )}
    </HeadlessMenu>
  );
}

const MenuItems = ({
  open,
  align,
  children,
  marginTop,
  small,
}: {
  open: boolean;
  align?: "left" | "right";
  children: React.ReactNode;
  marginTop?: `mt-${number}`;
  small?: boolean;
}) => {
  return (
    <MenuTransition
      show={open}
      className={cl("absolute z-10", align === "right" && "right-0")}
    >
      <HeadlessMenu.Items
        static
        className={cl(
          "bg-gray-800 rounded shadow flex flex-col outline-none overflow-hidden ring-1 ring-gray-600",
          small ? "w-36" : "w-52",
          marginTop ?? "mt-1"
        )}
        data-focus-remain="true"
      >
        {children}
      </HeadlessMenu.Items>
    </MenuTransition>
  );
};

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
            disabled ? "text-gray-400" : "text-gray-200",
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
            <Icon className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </button>
      )}
    </HeadlessMenu.Item>
  );
});

function MenuDragItem<T>({
  label,
  item,
  type,
  id,
  onClick: onClickFromProps,
}: {
  label: string;
  item: T;
  type: string;
  id: string;
  onClick?: (value: T) => void;
}) {
  const { ref, dragHandleProps } = useDragItem({
    id,
    type,
    item,
    mode: "move",
  });

  const onClick = React.useCallback(() => {
    if (onClickFromProps) onClickFromProps(item);
  }, [onClickFromProps, item]);

  return (
    <Menu.Item
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      onClick={onClick}
      label={label}
      className="cursor-grab"
    />
  );
}

Menu.Item = MenuItem;
Menu.DragItem = MenuDragItem;
Menu.Items = MenuItems;

export { Menu };
