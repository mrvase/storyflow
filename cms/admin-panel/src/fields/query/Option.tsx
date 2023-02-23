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
  style,
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
  style?: any;
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
        "group pl-3 pr-2 h-10 shrink-0 rounded text-sm cursor-default",
        isSelected && "bg-gray-750",
        "hover:ring-1 hover:ring-inset hover:ring-gray-700",
        "flex items-center justify-between",
        !style && "transition-colors"
      )}
      style={style}
      onMouseDown={(ev) => {
        ev.preventDefault();
      }}
      onClick={onClick}
    >
      <div
        className={cl(
          "flex gap-3 items-center",
          !style && "text-white text-opacity-90"
        )}
      >
        <div>{Icon && <Icon className="w-4 h-4" />}</div>
        <div>
          {children}
          {secondaryText && (
            <div
              className={cl(
                "text-xs -mt-0.5",
                !style && "text-gray-300 text-opacity-75"
              )}
            >
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
                "text-xs flex gap-2 py-1.5 px-3 rounded",
                "peer hover:bg-gray-600 transition-colors",
                !style && "text-gray-300 text-opacity-50"
              )}
            >
              {onArrowRightLabel ?? "indsæt"}
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          <button
            className={cl(
              "text-xs flex gap-2 py-1.5 px-3 rounded",
              !style && "text-gray-300 text-opacity-50",
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
