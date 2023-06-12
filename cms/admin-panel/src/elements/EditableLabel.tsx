import cl from "clsx";
import { XMarkIcon } from "@heroicons/react/24/outline";
import React from "react";
import { flushSync } from "react-dom";

export function EditableLabel({
  value: initialValue,
  onChange,
  className,
  large,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  large?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = React.useState(false);

  const [value, setValue] = React.useState(initialValue);

  React.useLayoutEffect(() => {
    setValue(initialValue);
    setWidth();
  }, [initialValue]);

  React.useLayoutEffect(() => setWidth(), [isEditing]);

  const setWidth = () => {
    if (ref.current) {
      ref.current.style.width = "0px";
      let value = ref.current.value;
      if (value === "") ref.current.value = "Ingen label";
      const newWidth = ref.current.scrollWidth;
      if (value === "") ref.current.value = "";
      ref.current.style.width = `${newWidth}px`;
    }
  };

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = ev.target.value;
    flushSync(() => {
      setValue(newValue);
    });
    setWidth();
  };

  const rejected = React.useRef(false);

  const accept = () => {
    if (!rejected.current) {
      if (value !== initialValue) {
        onChange(value);
      }
    } else {
      rejected.current = false;
    }
  };

  const reject = () => {
    setValue(initialValue);
    rejected.current = true;
  };

  return (
    <div className="flex justify-start">
      <div
        className={cl(
          "flex leading-none pl-1 -ml-1 rounded",
          large ? "h-8 text-3xl" : "h-5 text-sm",
          isEditing && "ring-1 ring-gray-300 dark:ring-gray-600"
        )}
      >
        <input
          ref={ref}
          value={isEditing ? value : initialValue}
          onChange={handleChange}
          type="text"
          className={cl(
            "h-full flex items-center outline-none padding-0 margin-0 bg-transparent",
            className
          )}
          placeholder="Ingen label"
          onFocus={() => {
            setIsEditing(true);
            rejected.current = false;
          }}
          onBlur={() => {
            setIsEditing(false);
            accept();
          }}
          onKeyDown={(ev) => {
            if (ev.key.toLowerCase() === "enter") {
              ref.current?.blur();
            }
            if (ev.key.toLowerCase() === "escape") {
              reject();
              ref.current?.blur();
            }
          }}
        />
        {isEditing && (
          <div
            className={cl(
              "ml-2 shrink-0 aspect-square flex-center rounded bg-gray-100 text-gray-600 dark:bg-gray-750 dark:text-gray-100 hover:bg-red-100 hover:text-red-600",
              large ? "w-8 h-8" : "w-5 h-5"
            )}
            onMouseDown={() => {
              reject();
            }}
          >
            <XMarkIcon className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
