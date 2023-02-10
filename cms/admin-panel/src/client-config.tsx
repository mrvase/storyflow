import React from "react";
import type {
  ClientConfig,
  ComponentConfig,
  LibraryConfig,
} from "@storyflow/frontend/types";
import { SWRClient } from "./client";

const ClientConfigContext = React.createContext<Record<
  string,
  ClientConfig
> | null>(null);

export const getComponentType = (
  libraryName: string,
  componentName: string
) => {
  return libraryName ? [libraryName, componentName].join(":") : componentName;
};

export const getInfoFromType = (type: string) => {
  if (type.indexOf(":") < 0) {
    return {
      library: "",
      name: type,
    };
  }
  const [library, name] = type.split(":");
  return {
    library,
    name,
  };
};

export const getTypeFromConfig = (
  library: LibraryConfig,
  component: ComponentConfig
) => {
  return getComponentType(library.name, component.name);
};

export const getConfigFromType = (type: string, libraries: LibraryConfig[]) => {
  const { library, name } = getInfoFromType(type);
  const config = libraries.find((el) => el.name === library);

  if (!config) return;

  const result = Object.values(config.components).find(
    (el) => el.name === name
  );

  return result;
};

export function useClientConfig(key?: string): ClientConfig {
  const ctx = React.useContext(ClientConfigContext);
  if (!ctx) throw new Error("useClientConfig cannot find provider.");
  return (
    (key ? ctx[key] : Object.values(ctx)[0]) ?? {
      builderUrl: "",
      revalidateUrl: "",
      libraries: [defaultLibrary],
    }
  );
}

const defaultLibrary: LibraryConfig = {
  name: "",
  label: "Default",
  components: {
    Link: {
      label: "Link",
      name: "Link",
      props: [
        { name: "href", type: "string", label: "URL" },
        { name: "label", type: "string", label: "Label" },
      ],
      inline: true,
    },
    Outlet: {
      label: "Side",
      name: "Outlet",
      props: [],
    },
  },
};

export function ClientConfigProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [configs, setConfigs] = React.useState<Record<string, ClientConfig>>(
    {}
  );

  const { data } = SWRClient.settings.get.useQuery();

  React.useLayoutEffect(() => {
    if (!data) return;

    let isMounted = true;
    const abortController = new AbortController();

    (async () => {
      const fetchedConfigs = await Promise.all(
        data.domains.map(async ({ id, configUrl }) => {
          configUrl = configUrl.endsWith(".dk")
            ? `${configUrl}/api/config`
            : configUrl;

          if (process.env.NODE_ENV === "development") {
            configUrl = "http://localhost:3003/api/config";
          }

          if (!configUrl) return;

          const config = await fetch(configUrl, {
            signal: abortController.signal,
          }).then((res) => res.json());

          return [
            id,
            {
              builderUrl: config.builderUrl,
              revalidateUrl: config.revalidateUrl,
              libraries: [defaultLibrary, ...config.libraries],
            },
          ] as [string, ClientConfig];
        })
      );

      if (isMounted) {
        setConfigs(
          Object.fromEntries(
            fetchedConfigs.filter((el): el is Exclude<typeof el, undefined> =>
              Boolean(el)
            )
          )
        );
      }
    })();
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [data]);

  return (
    <ClientConfigContext.Provider value={configs}>
      {children}
    </ClientConfigContext.Provider>
  );
}
