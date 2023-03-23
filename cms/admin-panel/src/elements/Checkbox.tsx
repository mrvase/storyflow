import cl from "clsx";
import { CheckIcon } from "@heroicons/react/24/outline";
import React from "react";

export function Checkbox({
  name,
  value,
  setValue,
  label,
  className,
  small,
}: {
  name?: string;
  value?: boolean;
  setValue?: (value: boolean) => void;
  label?: string;
  className?: string;
  small?: boolean;
}) {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (setValue) setValue(e.target.checked);
    },
    []
  );

  return (
    <label className={cl("flex items-center gap-2", className)}>
      <div
        className={cl(
          "relative z-0 flex-center",
          small ? "w-3 h-3" : "w-4 h-4"
        )}
      >
        <input
          name={name}
          checked={value}
          onChange={handleChange}
          type="checkbox"
          className="peer w-0 h-0 opacity-0"
        />
        <div className="absolute inset-0 -z-10 bg-white dark:bg-gray-700 peer-checked:bg-gray-600 rounded transition-colors" />
        <CheckIcon
          className={cl(
            small ? "w-2 h-2" : "w-3 h-3",
            "opacity-0 peer-checked:opacity-100 text-gray-200 transition-opacity"
          )}
        />
      </div>
      {label}
    </label>
  );
}
