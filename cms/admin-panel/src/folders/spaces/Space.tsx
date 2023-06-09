import type { Space, SpaceId } from "@storyflow/cms/types";
import cl from "clsx";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import useIsFocused from "../../utils/useIsFocused";
import { DragIcon } from "../../elements/DragIcon";
import { useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";

function Space({
  space,
  label,
  index,
  buttons,
  children,
}: {
  space: Space;
  label: React.ReactNode;
  index: number;
  buttons: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  const { dragHandleProps, ref, state } = useSortableItem({
    id: space.id,
    index: index,
    item: space,
  });

  const style = getTranslateDragEffect(state);

  const { isFocused, handlers } = useIsFocused({
    multiple: true,
    id: space.id,
  });

  return (
    <div
      ref={ref}
      style={style}
      className={cl(
        "group/space mx-2.5 p-2.5 ring-1 rounded-md transition-shadow",
        "ring-transparent"
        /*
        isFocused
          ? "ring-yellow-200/60"
          : isOpen
          ? "ring-transparent hover:ring-gray-100 dark:hover:ring-gray-700/50"
          : "ring-transparent"
        */
      )}
      {...(isOpen ? handlers : {})}
    >
      <div className="flex items-center mb-3.5 h-7">
        <div
          className={cl(
            "cursor-grab transition-opacity w-4 mr-5 hidden @sm:block",
            isOpen
              ? "opacity-75 hover:opacity-100"
              : "opacity-0 pointer-events-none"
          )}
          {...dragHandleProps}
        >
          <DragIcon className="w-5 h-5 -ml-0.5 text-yellow-200" />
        </div>
        <h2 className="text-sm text-gray-600 dark:text-gray-400 flex-center font-medium">
          {label}
        </h2>
        <div className={cl("ml-auto flex gap-2", "transition-opacity")}>
          {buttons}
        </div>
      </div>
      {children}
    </div>
  );
}

const Button = React.forwardRef<
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
        "shrink-0 w-5 h-5 rounded-full ring-button p-1",
        selected === false
          ? "text-gray-800 dark:text-white text-opacity-50 dark:text-opacity-50"
          : "text-button",
        active &&
          "text-opacity-100 dark:text-opacity-100 ring-gray-300 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {props.children}
    </button>
  );
});

export default Object.assign(Space, {
  Button,
});
