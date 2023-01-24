import cl from "clsx";
import {
  CogIcon,
  MinusIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import { useOrganisationSlug } from "../../users";

export default function Nav() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const [dialog, setDialog] = React.useState<string | null>(null);

  const slug = useOrganisationSlug();

  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dark-mode", true);
  const DarkIcon = darkMode ? MoonIcon : SunIcon;

  React.useEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  return (
    <>
      <div
        className={cl(
          "h-screen flex flex-col shrink-0 grow-0 overflow-hidden transition-[width] ease-out",
          isOpen ? "w-56" : "w-0",
          "text-gray-600 dark:text-white"
        )}
      >
        <div className="h-full flex flex-col justify-between pl-2 py-2">
          <div className="h-12 flex items-center">
            <button
              className="text-sm h-8 px-2 flex items-center rounded-md transition-colors"
              onClick={() => setIsOpen((ps) => !ps)}
            >
              <MinusIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-auto flex justify-evenly">
            <button
              className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDialog("user")}
            >
              <UserIcon className="w-6 h-6" />
            </button>
            <button
              className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDarkMode((ps) => !ps)}
            >
              <DarkIcon className="w-6 h-6" />
            </button>
            <button className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors">
              <CogIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="w-full h-11 mt-auto px-3 flex-center font-black tracking-wider text-sm">
          <span className="bg-clip-text bg-gradient-to-br from-orange-600 to-pink-600 text-transparent">
            Storyflow
          </span>
        </div>
      </div>
    </>
  );
}
