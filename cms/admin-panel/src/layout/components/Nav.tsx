import cl from "clsx";
import {
  CogIcon,
  MinusIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useLocalStorage } from "../../state/useLocalStorage";
import { useOrganisationSlug } from "../../users";
import Dialog from "../../elements/Dialog";
import { SWRClient } from "../../client";
import { Settings } from "@storyflow/backend/types";
import { createId } from "@storyflow/backend/ids";
import { Spinner } from "../../elements/Spinner";

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
      <Dialog
        isOpen={dialog === "settings"}
        close={() => setDialog(null)}
        title="Indstillinger"
      >
        <SettingsDialog />
      </Dialog>
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
            <a
              className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              href="/bruger"
            >
              <UserIcon className="w-6 h-6" />
            </a>
            <button
              className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDarkMode((ps) => !ps)}
            >
              <DarkIcon className="w-6 h-6" />
            </button>
            <button
              className="flex-center w-12 h-12 hover:bg-gray-400/25 dark:hover:bg-gray-850 rounded transition-colors"
              onClick={() => setDialog("settings")}
            >
              <CogIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="w-full h-11 mt-auto px-3 flex-center font-black tracking-wider text-sm">
          <span className="text-white">Storyflow</span>
        </div>
      </div>
    </>
  );
}

function SettingsDialog() {
  const [focused, setFocused] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  const { data } = SWRClient.settings.get.useQuery();
  const update = SWRClient.settings.set.useMutation({
    cacheUpdate(input, mutate) {
      mutate(["get", undefined], (ps, settings) => {
        return input;
      });
    },
  });

  const [urls, setUrls] = React.useState<Settings["domains"]>(
    data?.domains ?? []
  );
  React.useEffect(() => setUrls(data?.domains ?? []), [data]);

  const showAutoComplete = (url: string, index: number) =>
    (url.endsWith(".dk") || url.endsWith(".com")) && focused !== index;

  return (
    <div className="flex flex-col w-full gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-sm">Domæner</div>
        {urls.map(({ configUrl }, index) => (
          <div
            className={cl(
              "relative z-0 flex border rounded transition-colors",
              focused === index ? "border-white/20" : "border-white/5"
            )}
          >
            <div
              className={cl(
                "flex items-center inset-0 px-3 absolute -z-10 font-light pointer-events-none transition-opacity",
                showAutoComplete(configUrl, index) ? "opacity-50" : "opacity-0"
              )}
            >
              <span className="opacity-0">{configUrl}</span>
              <span>/api/config</span>
            </div>
            <input
              type="text"
              className="h-10 flex items-center px-3 grow bg-transparent outline-none font-light auto-complete"
              onFocus={() => setFocused(index)}
              onBlur={() => setFocused(null)}
              value={configUrl}
              onChange={(ev) =>
                setUrls((oldUrls) => {
                  const urls = [...oldUrls];
                  urls[index] = {
                    ...urls[index],
                    configUrl: ev.target.value,
                  };
                  return urls;
                })
              }
            />
            <button
              className="h-10 w-10 flex-center opacity-50 hover:opacity-100 transition-opacity"
              onClick={() => {
                setUrls((oldUrls) => {
                  const urls = [...oldUrls];
                  urls.splice(index, 1);
                  return urls;
                });
              }}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="h-10 font-light text-sm">
          <button
            className="group h-10 flex items-center opacity-50 hover:opacity-100 transition-opacity"
            onClick={() =>
              setUrls((ps) => [...ps, { id: createId(1), configUrl: "" }])
            }
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <PlusIcon className="w-4 h-4" />
            </span>
            <span className="-translate-x-4 group-hover:translate-x-1.5 transition-transform">
              Tilføj domæne
            </span>
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="rounded px-4 py-2 text-sm font-light opacity-50 hover:opacity-100 transition-opacity">
          Annuller
        </button>
        <button
          className="flex rounded px-4 py-2 bg-teal-600 hover:bg-teal-500 text-sm font-light transition-colors"
          onClick={async () => {
            if (!loading) {
              setLoading(true);
              await update({
                domains: urls,
              });
              setLoading(false);
            }
          }}
        >
          {loading ? (
            <>
              <Spinner /> Gemmer...
            </>
          ) : (
            "Gem ændringer"
          )}
        </button>
      </div>
    </div>
  );
}
