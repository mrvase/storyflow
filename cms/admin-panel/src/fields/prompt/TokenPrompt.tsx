import cl from "clsx";
import {
  CalendarDaysIcon,
  SwatchIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { TokenStream } from "operations/types";
import { useOption } from "./OptionsContext";
import React from "react";
import { parseDateFromString } from "../../data/dates";

export function TokenPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const [isSelected, ref] = useOption();

  const date = React.useMemo(() => {
    return parseDateFromString(prompt);
  }, [prompt]);

  return (
    <div className="p-2.5">
      <div
        ref={ref}
        className={cl(
          "p-2.5 rounded",
          "group flex items-center gap-2",
          isSelected && "bg-gray-800",
          "hover:ring-1 hover:ring-inset hover:ring-gray-700"
        )}
      >
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-cyan-600 to-cyan-700 shadow-sm text-sky-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <CalendarDaysIcon className="w-4 h-4 inline" />
          {Intl.DateTimeFormat("da-DK", {
            weekday: "long",
          })
            .format(date)
            .slice(0, 3)}{" "}
          {Intl.DateTimeFormat("da-DK", {
            dateStyle: "long",
            ...([date.getHours(), date.getMinutes(), date.getSeconds()].some(
              Boolean
            )
              ? { timeStyle: "short" }
              : {}),
          }).format(date)}
        </div>
        <div
          className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b dark:bg-white shadow-sm text-black rounded px-2 py-0.5 flex-center gap-2"
          onMouseDown={(ev) => {
            ev.preventDefault();
          }}
          onClick={() => {
            replacePromptWithStream([{ color: "#ffffff" }]);
          }}
        >
          <SwatchIcon className="w-4 h-4 inline" />
          White
        </div>
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-sm text-green-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <CheckIcon className="w-4 h-4 inline" />
          Sand
        </div>
        <div className="group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity cursor-default bg-gradient-to-b from-pink-600 to-pink-700 shadow-sm text-red-100/90 rounded px-2 py-0.5 flex-center gap-2">
          <XMarkIcon className="w-4 h-4 inline" />
          Falsk
        </div>
      </div>
    </div>
  );
}
