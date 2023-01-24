import cl from "clsx";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import React from "react";

type Option = { label: string; value: any; color?: string } | string;

export default function Select({
  label = "",
  value,
  setValue,
  options: optionsProp,
  dark,
  variant = "border",
  children,
  className,
}: {
  label?: string;
  value: any;
  setValue: (value: string) => void;
  options: Option[];
  dark?: boolean;
  variant?: string;
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

  const containerClasses = () =>
    ({
      border: cl(
        "border",
        dark
          ? isOpen
            ? "border-gray-600 bg-gray-800"
            : "border-white/10 hover:border-white/20"
          : isOpen
          ? "border-black/30"
          : "border-black/10 hover:border-black/2"
      ),
      fuchsia: cl(
        "border transition-colors",
        dark ? "text-fuchsia-200" : "text-black/80",
        isOpen
          ? "border-fuchsia-500/40 bg-fuchsia-600/40"
          : "border-fuchsia-500/20 bg-fuchsia-600/20 hover:bg-fuchsia-600/40"
      ),
    }[variant]);

  const dropdownClasses = () =>
    ({
      border: cl(
        "border border-t-0",
        dark
          ? `bg-gray-800 text-white border-gray-600`
          : `bg-white text-black/80 border-black/30`
      ),
      fuchsia: cl(
        "border border-t-0",
        "border-fuchsia-500/40 text-fuchsia-200 bg-fuchsia-600/40"
      ),
    }[variant]);

  const optionClasses = ({
    selected,
    active,
  }: {
    selected: boolean;
    active: boolean;
  }) =>
    ({
      border: cl(
        selected
          ? active
            ? "bg-gray-700"
            : "bg-gray-850"
          : active
          ? "bg-gray-700"
          : "bg-transparent"
      ),
      fuchsia: cl(
        selected
          ? active
            ? "bg-white/20"
            : "bg-white/5"
          : active
          ? "bg-white/10"
          : "bg-transparent"
      ),
    }[variant]);

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
        <div className="">
          <div
            className={cl(
              "h-10 w-full cursor-default overflow-hidden rounded-t-md font-light",
              dark ? "text-white" : "text-black/80",
              containerClasses(),
              !isOpen && "rounded-b-md"
            )}
          >
            <div className="absolute pointer-events-none text-[0.65rem] px-3 top-1 opacity-60">
              {label}
            </div>
            <div
              className={cl(
                "absolute h-full w-full flex items-center px-3 pointer-events-none",
                label && "pt-4"
              )}
            >
              {query
                ? ""
                : options.find((el) => el.value === value)?.label ?? ""}
            </div>
            <Combobox.Input
              ref={inputRef}
              className={cl(
                "border-none h-full w-full flex px-3 outline-none bg-transparent font-light",
                label && "pt-4",
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
                "absolute -mt-[1px] max-h-60 w-full overflow-auto rounded-b-md shadow-lg text-sm",
                dark ? "bg-gray-600" : "bg-transparent"
              )}
            >
              <div className={cl("rounded-b-md", dropdownClasses())}>
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
                          optionClasses({ selected, active }),
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
                              selected ? "font-base" : "font-light"
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
        </div>
      </Combobox>
    </div>
  );
}
