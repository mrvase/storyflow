import cl from "clsx";
import {
  ArrowRightIcon,
  ArrowUturnRightIcon,
} from "@heroicons/react/24/outline";
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from "lexical";
import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";

export function Option<T>({
  isSelected,
  onEnter,
  onEnterLabel,
  value,
  onArrowRight,
  onArrowRightLabel,
  children,
  secondaryText,
  Icon,
}: {
  isSelected: boolean;
  onEnter: (value: T) => void;
  value: T;
  onEnterLabel?: string;
  onArrowRight?: () => void;
  onArrowRightLabel?: string;
  children: React.ReactNode;
  secondaryText?: React.ReactNode;
  Icon?: React.FC<any>;
}) {
  const editor = useEditorContext();

  React.useEffect(() => {
    if (isSelected) {
      return editor.registerCommand(
        KEY_ENTER_COMMAND,
        (ev) => {
          ev?.preventDefault();
          onEnter(value);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      );
    }
  }, [isSelected, onEnter, value]);

  const onClick = React.useCallback(() => onEnter(value), [onEnter, value]);

  return (
    <div
      className={cl(
        "group pl-3 pr-2 h-10 shrink-0 rounded text-sm hover:bg-gray-750 transition-colors",
        isSelected && "ring-1 ring-inset ring-gray-700",
        "flex items-center justify-between"
      )}
      onMouseDown={(ev) => {
        ev.preventDefault();
      }}
      onClick={onClick}
    >
      <div className="flex gap-3 items-center text-white text-opacity-90">
        <div>{Icon && <Icon className="w-4 h-4" />}</div>
        <div>
          {children}
          {secondaryText && (
            <div className="text-xs text-gray-300 text-opacity-75 -mt-0.5">
              {secondaryText}
            </div>
          )}
        </div>
      </div>
      {isSelected && (
        <div className="flex">
          {onArrowRight && (
            <button
              className={cl(
                "text-gray-300 text-opacity-50 text-xs flex gap-2 py-1.5 px-3 rounded",
                "peer hover:bg-gray-600 transition-colors"
              )}
            >
              {onArrowRightLabel ?? "indsæt"}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          <button
            className={cl(
              "text-gray-300 text-opacity-50 text-xs flex gap-2 py-1.5 px-3 rounded",
              onArrowRight &&
                "group-hover:bg-gray-600 peer-hover:bg-transparent transition-colors"
            )}
          >
            {onEnterLabel ?? "indsæt"}
            <ArrowUturnRightIcon className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}
