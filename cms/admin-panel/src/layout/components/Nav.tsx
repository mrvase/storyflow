import cl from "clsx";
import {
  ChevronLeftIcon,
  CogIcon,
  DocumentIcon,
  FolderIcon,
  MinusIcon,
  MoonIcon,
  PhotoIcon,
  SunIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import Dialog from "../../elements/Dialog";
import { SettingsDialog } from "./SettingsDialog";
import { Link } from "@storyflow/router";
import useTabs from "../useTabs";
import { useTabUrl } from "../utils";

export default function Nav() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  const [dialog, setDialog] = React.useState<string | null>(null);

  const [darkMode, setDarkMode] = useLocalStorage<boolean>("dark-mode", true);
  const DarkIcon = darkMode ? MoonIcon : SunIcon;

  React.useEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  let [, navigateTab] = useTabUrl();

  return (
    <>
      <Dialog
        isOpen={dialog === "settings"}
        close={() => setDialog(null)}
        title="Indstillinger"
      >
        <SettingsDialog close={() => setDialog(null)} />
      </Dialog>
      <div
        className={cl(
          "h-screen flex flex-col shrink-0 grow-0 overflow-hidden transition-[width] ease-out",
          isOpen ? "w-48" : "w-0",
          "text-gray-600 dark:text-white"
        )}
      >
        <div className="h-full flex flex-col justify-between pl-2 py-2 w-48">
          <div className="mt-auto flex justify-end gap-2">
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => navigateTab("/~0/folders")}
            >
              <FolderIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => navigateTab("/~0/templates")}
            >
              <DocumentIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => navigateTab("/~0/files")}
            >
              <PhotoIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <a
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              href="/bruger"
            >
              <UserIcon className="w-5 h-5" />
            </a>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDarkMode((ps) => !ps)}
            >
              <DarkIcon className="w-5 h-5" />
            </button>
            <button
              className="flex-center w-10 h-10 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDialog("settings")}
            >
              <CogIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/*<div className="w-full h-11 mt-auto px-3 flex-center font-black tracking-wider text-sm">
          <span className="text-white">Storyflow</span>
        </div>
        */}
      </div>
    </>
  );
}
