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

  return (
    <label className="relative flex flex-col p-5 w-full select-none">
      <input
        type="radio"
        name="group"
        defaultChecked={defaultChecked}
        className="peer w-0 h-0 opacity-0"
      />
      <div className="absolute ring-1 ring-gray-700 peer-checked:bg-gray-750 inset-0 -z-10 rounded" />
      <div className="flex items-center">
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
          className="absolute top-5 right-5 h-8 px-3 flex-center bg-white/10 hover:bg-white/20 rounded font-normal text-sm transition-colors"
        >
          {buttonLabel}
        </button>
        <div className="ml-8 mt-4 mb-1">
          <div className="text-sm font-normal mb-1">{formLabel}</div>
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
              type="text"
              name="value"
              className="ring-button bg-transparent rounded h-8 flex items-center px-2.5 outline-none w-full"
              autoComplete="off"
            />
          )}
        </div>
      </form>
    </label>
  );
}
