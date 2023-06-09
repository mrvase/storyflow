import React from "react";
import Select from "./Select";

export function DialogOption({
  type,
  label,
  icon: Icon,
  defaultChecked,
  onSubmit,
  input = {},
}: {
  type: string;
  label: string;
  defaultChecked?: boolean;
  icon: React.FC<{ className?: string }>;
  onSubmit: (type: string, data: FormData) => void;
  input?: {
    label?: string;
    button?: string;
    options?: { label: string; value: string }[];
    defaultValue?: string;
  };
}) {
  const {
    label: formLabel = "Navn",
    button: buttonLabel = "Opret",
    options,
    defaultValue,
  } = input;

  const [selected, setSelected] = React.useState(defaultValue ?? null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (defaultChecked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [defaultChecked]);

  return (
    <label className="relative flex flex-col p-5 w-full select-none">
      <input
        type="radio"
        name="group"
        defaultChecked={defaultChecked}
        className="peer w-0 h-0 opacity-0"
        onFocus={() => requestAnimationFrame(() => inputRef.current?.focus())}
      />
      <div className="absolute ring-1 ring-gray-200 dark:ring-gray-750 peer-checked:ring-gray-400 peer-checked:dark:ring-gray-600 inset-0 -z-10 rounded" />
      <div className="flex items-center font-medium">
        <Icon className="w-5 h-5 mr-3" />
        {label}
      </div>
      <form
        className="hidden peer-checked:block"
        onSubmit={(ev) => {
          ev.preventDefault();
          onSubmit(type, new FormData(ev.target as HTMLFormElement));
        }}
      >
        <button
          type="submit"
          className="absolute top-3 right-5 h-10 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded font-medium text-sm transition-colors"
        >
          {buttonLabel}
        </button>
        <div className="ml-8 mt-4 mb-1">
          <div className="text-sm font-medium mb-1">{formLabel}</div>
          {options ? (
            <>
              <Select
                value={selected}
                setValue={setSelected}
                options={options}
              />
              <input type="hidden" name="value" value={selected ?? ""} />
            </>
          ) : (
            <input
              ref={inputRef}
              type="text"
              name="value"
              className="ring-button bg-transparent rounded h-10 flex items-center px-2.5 outline-none w-full"
              autoComplete="off"
            />
          )}
        </div>
      </form>
    </label>
  );
}
