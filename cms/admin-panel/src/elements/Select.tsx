import cl from "clsx";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import React from "react";

type Option = { label: string; value: any; color?: string } | string;

export default function Select({
  value,
  setValue,
  options: optionsProp,
  children,
  className,
}: {
  value: any;
  setValue: (value: any) => void;
  options: Option[];
  children?: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");

  const [isOpen, setIsOpen] = React.useState(false);

  const options = optionsProp.map((el) => {
    if (typeof el === "string") {
      return {
        value: el,
        label: el,
      };
    }
    return el;
  });

  const filteredOptions =
    query === ""
      ? options
      : options.filter((person) =>
          person.label
            .toLowerCase()
            .replace(/\s+/g, "")
            .includes(query.toLowerCase().replace(/\s+/g, ""))
        );

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className={cl("w-full relative", isOpen && "z-50", className)}>
      <Combobox
        value={value}
        onChange={(value) => {
          setValue(value);
          inputRef.current?.blur();
        }}
      >
        <div
          className={cl(
            "h-8 w-full cursor-default overflow-hidden rounded-t",
            "ring-button",
            !isOpen && "rounded-b"
          )}
        >
          <div
            className={cl(
              "absolute h-full w-full flex items-center px-3 pointer-events-none"
            )}
          >
            {query ? "" : options.find((el) => el.value === value)?.label ?? ""}
          </div>
          <Combobox.Input
            ref={inputRef}
            className={cl(
              "border-none h-full w-full flex px-3 outline-none bg-transparent",
              !isOpen && "cursor-default"
            )}
            displayValue={(value) => ""}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              setIsOpen(false);
              setQuery("");
            }}
            onClick={(ev: any) => {
              ev.target.setSelectionRange(0, ev.target.value.length);
            }}
            autoComplete="off"
          />
          <button
            className="absolute inset-y-0 right-0 flex items-center px-3"
            tabIndex={-1}
            onClick={() => {
              if (isOpen) {
                // inputRef.current?.blur();
              } else {
                inputRef.current?.focus();
              }
            }}
          >
            <ChevronUpDownIcon className="w-4 h-4" />
          </button>
          {children}
        </div>
        {isOpen && (
          <Combobox.Options
            static
            className={cl(
              "absolute z-20 -mt-[1px] max-h-60 w-full overflow-auto rounded-b-md shadow-lg text-sm",
              "bg-white dark:bg-gray-700"
            )}
          >
            <div className={cl("rounded-b-md")}>
              {filteredOptions.length === 0 && query !== "" ? (
                <div className="relative cursor-default select-none py-2 px-4">
                  Intet resultat
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <Combobox.Option
                    key={option.value}
                    className={({ selected, active }) =>
                      cl(
                        "relative cursor-default select-none py-2 px-3",
                        active && "bg-gray-100 dark:bg-gray-600",
                        option.color
                      )
                    }
                    value={option.value}
                    onMouseDown={(ev: any) => ev.preventDefault()}
                  >
                    {({ selected, active }) => (
                      <>
                        <span
                          className={`block truncate ${
                            selected ? "font-semibold" : ""
                          }`}
                        >
                          {option.label}
                        </span>
                      </>
                    )}
                  </Combobox.Option>
                ))
              )}
            </div>
          </Combobox.Options>
        )}
      </Combobox>
    </div>
  );
}
