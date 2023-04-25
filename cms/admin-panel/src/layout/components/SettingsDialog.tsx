import cl from "clsx";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import React from "react";
import { SWRClient, useClient } from "../../client";
import { Spinner } from "../../elements/Spinner";
import { isSuccess, unwrap } from "@storyflow/result";
import { useUrlInfo } from "../../users";

export function SettingsDialog({ close }: { close: () => void }) {
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

  const { organization, version } = useUrlInfo();

  const client = useClient();

  const [urls, setUrls] = React.useState<
    ({ id: string; configUrl: string } & { new?: boolean })[]
  >(data?.domains ?? []);
  React.useEffect(() => setUrls(data?.domains ?? []), [data]);

  const showAutoComplete = (url: string, index: number) =>
    (url.endsWith(".dk") || url.endsWith(".com")) && focused !== index;

  const [keys, setKeys] = React.useState<Record<string, string>>({});

  return (
    <div className="flex flex-col w-full gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-sm">Domæner</div>
        {urls.map(({ id, configUrl, new: isNew }, index) => (
          <>
            <div
              className={cl(
                "relative z-0 flex border rounded transition-colors",
                focused === index ? "border-white/20" : "border-white/5"
              )}
            >
              <div
                className={cl(
                  "flex items-center inset-0 px-3 absolute -z-10 pointer-events-none transition-opacity",
                  showAutoComplete(configUrl, index)
                    ? "opacity-50"
                    : "opacity-0"
                )}
              >
                <span className="opacity-0">{configUrl}</span>
                <span>/api/config</span>
              </div>
              <input
                type="text"
                className="h-10 flex items-center px-3 grow bg-transparent outline-none auto-complete"
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
            {!isNew && (
              <div className="text-xs">
                Key: {keys[id] ?? ""} (
                <button
                  onClick={async () => {
                    const keyResponse =
                      await client.settings.generateKey.mutation(id);
                    if (isSuccess(keyResponse)) {
                      setKeys((ps) => ({ ...ps, [id]: unwrap(keyResponse) }));
                    }
                  }}
                >
                  Generer
                </button>
                )
              </div>
            )}
          </>
        ))}
        <div className="h-10 text-sm">
          <button
            className="group h-10 flex items-center opacity-50 hover:opacity-100 transition-opacity"
            onClick={() =>
              setUrls((ps) => [
                ...ps,
                {
                  id: Math.random().toString(16).slice(2, 14),
                  configUrl: "",
                  new: true,
                },
              ])
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
      <div className="py-5">
        <button
          onClick={async () => {
            const newVersion = Number(!version);
            await client.settings.changeVersion.mutation({
              slug: organization,
              version: newVersion,
            });
            const url = new URL(window.location.href);
            window.location.href = `${url.origin}/v${newVersion}/${organization}`;
          }}
        >
          Skift version
        </button>
      </div>
      <div className="flex justify-end">
        <button
          className="rounded px-4 py-2 text-sm opacity-50 hover:opacity-100 transition-opacity"
          onClick={close}
        >
          Annuller
        </button>
        <button
          className="flex rounded px-4 py-2 bg-teal-600 hover:bg-teal-500 text-sm transition-colors"
          onClick={async () => {
            if (!loading) {
              setLoading(true);
              await update({
                domains: urls.map(({ new: _, ...rest }) => rest),
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
