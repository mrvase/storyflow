import React from "react";
import cl from "clsx";
import { StatusButton } from "./TabBar";
import { useClient } from "../../client";
import { unwrap } from "@storyflow/result";
import { isDev } from "../../utils/isDev";

export function CommandLine() {
  const [isFocused, setIsFocused] = React.useState(false);

  const client = useClient();

  const [actions, setActions] = React.useState<
    { type: string; text: string; label: string; folder?: string }[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const hasActions = actions.length > 0;

  const getResults = async (prompt: string) => {
    if (!prompt || !isDev) return;
    setIsLoading(true);
    const results = await client.ai.getActions.query({
      prompt,
      // actions: actions.map((el) => el.text),
    });
    // setActions((ps) => [...ps, ...unwrap(results, [])]);
    setIsLoading(false);
  };

  return (
    <div
      className={cl(
        "relative w-full flex justify-start items-start rounded-md border border-gray-200 dark:border-gray-800",
        isFocused ? "bg-gray-50 dark:bg-gray-850" : "bg-white dark:bg-gray-900",
        "transition-colors ease-out"
      )}
    >
      {(isLoading || hasActions) && (
        <div className="absolute w-full bottom-14 bg-gray-750 p-5 rounded">
          {isLoading && <div>Loading...</div>}
          {hasActions &&
            actions.map((el, index) => (
              <div key={index}>
                {el.type} / {el.label} / {el.folder}
              </div>
            ))}
        </div>
      )}
      <input
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            getResults((ev.target as any).value ?? "");
          }
        }}
        type="text"
        className={cl(
          "w-full h-full flex items-center bg-transparent outline-none px-3 font-light placeholder:text-gray-400/50"
        )}
        placeholder="Indtast kommando"
      />
      <StatusButton />
    </div>
  );
}
