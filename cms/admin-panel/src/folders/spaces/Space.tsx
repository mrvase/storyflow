import { SpaceId } from "@storyflow/backend/types";
import cl from "clsx";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import useIsFocused from "../../utils/useIsFocused";
import { DragIcon } from "./DragIcon";

function Space({
  id,
  label,
  buttons,
  children,
}: {
  id: SpaceId;
  label: React.ReactNode;
  buttons: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  const { isFocused, handlers } = useIsFocused({
    multiple: true,
    id,
  });

  return (
    <div
      className={cl(
        "group/space mx-2.5 p-2.5 ring-1 rounded-md transition-shadow",
        isFocused
          ? "ring-yellow-200/60"
          : isOpen
          ? "ring-transparent hover:ring-gray-700/50"
          : "ring-transparent"
      )}
      {...(isOpen ? handlers : {})}
    >
      <div className="flex items-center mb-3.5 h-7">
        <div className="cursor-grab opacity-25 hover:opacity-100 transition-opacity">
          <DragIcon className="w-4 h-4 mr-5" />
        </div>
        <h2 className="text-gray-300 flex-center font-medium">{label}</h2>
        <div
          className={cl(
            "ml-auto flex gap-2",
            "opacity-50 group-hover/space:opacity-100 transition-opacity"
          )}
        >
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
        "rounded p-1.5",
        selected === false
          ? "text-gray-800 dark:text-white text-opacity-50 dark:text-opacity-50"
          : "text-button",
        active &&
          "text-opacity-100 dark:text-opacity-100 ring-gray-600 dark:ring-gray-600",
        props.className
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {props.children}
    </button>
  );
});

export default Object.assign(Space, {
  Button,
});
