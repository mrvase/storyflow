import cl from "clsx";
import { Menu as HeadlessMenu } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { MenuTransition } from "./transitions/MenuTransition";
import React from "react";
import { useDragItem } from "@storyflow/dnd";

type PropsOf<TTag extends ReactTag> = TTag extends React.ElementType
  ? React.ComponentProps<TTag>
  : {};

type ReactTag =
  | keyof JSX.IntrinsicElements
  | React.JSXElementConstructor<{
      active?: boolean;
      icon?: React.FC<{ className?: string }>;
      menu?: boolean;
    }>;

function Menu<
  TTag extends ReactTag,
  TOption extends { label: string; disabled?: boolean }
>(
  propsFromArg: {
    as: TTag;
    label?: string;
    selected?: TOption[] | TOption | null;
    align?: "left" | "right";
    onClear?: () => void;
    small?: boolean;
  } & Omit<
    PropsOf<TTag>,
    | "as"
    | "label"
    | "selected"
    | "align"
    | "onClear"
    | "small"
    | "children"
    | "options"
    | "onSelect"
    | "multi"
  > &
    (
      | {
          options: TOption[];
          onSelect: (value: TOption) => void;
          multi?: boolean;
        }
      | { children: React.ReactNode }
    )
) {
  const { as, label, selected, onClear, align, small, ...props } = propsFromArg;

  let {
    options: _,
    onSelect: __,
    multi: ___,
    children: ____,
    ...restProps
  } = "children" in props
    ? { ...props, options: undefined, onSelect: undefined, multi: undefined }
    : { ...props, children: undefined };

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
            as={as as any}
            active={open}
            data-focus-remain="true"
            menu
            {...restProps}
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
      className={cl("absolute z-[999]", align === "right" && "right-0")}
    >
      <HeadlessMenu.Items
        static
        className={cl(
          "bg-white dark:bg-gray-850 rounded flex flex-col outline-none overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 shadow-xl shadow-black/5",
          small ? "w-44" : "w-64",
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
    icon?: React.FC<{ className?: string }>;
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
            "py-2 px-2 flex items-center gap-2 text-sm transition-colors",
            active && "rounded bg-gray-100 dark:bg-gray-800",
            disabled ? "text-gray-400" : "",
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
            <Icon className="w-4 h-4 shrink-0" />
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
  icon,
  onClick: onClickFromProps,
}: {
  label: string;
  item: T;
  type: string;
  id: string;
  icon?: React.FC<{ className?: string }>;
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
      icon={icon}
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
