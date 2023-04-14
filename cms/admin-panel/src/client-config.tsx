import React from "react";
import type {
  ClientConfig,
  ComponentConfig,
  LibraryConfig,
} from "@storyflow/frontend/types";
import { SWRClient } from "./client";
import { useFolderDomains } from "./folders/FolderDomainsContext";

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

const defaultLibrary: LibraryConfig = {
  name: "",
  label: "Default",
  components: {
    Link: {
      label: "Link",
      name: "Link",
      props: [
        { name: "label", type: "string", label: "Label", searchable: true },
        { name: "href", type: "string", label: "URL" },
      ],
      inline: true,
    },
    Outlet: {
      label: "Side",
      name: "Outlet",
      props: [],
    },
    Loop: {
      label: "Gentag",
      name: "Loop",
      props: [
        { name: "children", type: "children", label: "Indhold" },
        { name: "data", type: "children", label: "Data" },
      ],
    },
  },
};

const defaultClientConfig: ClientConfig = {
  builderUrl: "",
  revalidateUrl: "",
  libraries: [defaultLibrary],
};

const defaultLibraries = [defaultLibrary]; // stable reference

export function useClientConfig(key?: string): ClientConfig {
  const configs = React.useContext(ClientConfigContext);
  const domains = useFolderDomains();
  if (!configs) {
    throw new Error("useClientConfig cannot find provider.");
  }

  if (key) {
    return configs[key] ?? defaultClientConfig;
  }

  if (!domains) {
    throw new Error("useClientConfig must be used within a FolderPage");
  }

  // TODO should return union of all config libraries

  if (!Object.keys(configs ?? []).length) {
    return defaultClientConfig;
  }

  const main = configs[domains[0]];

  return {
    builderUrl: main?.builderUrl ?? "",
    revalidateUrl: main?.revalidateUrl ?? "",
    libraries: main?.libraries ?? defaultLibraries,
  };
}

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
      const fetchedConfigs = await Promise.allSettled(
        data.domains.map(async ({ id, configUrl }) => {
          configUrl = configUrl.endsWith(".dk")
            ? `${configUrl}/api/config`
            : configUrl;

          if (process.env.NODE_ENV === "development") {
            configUrl =
              {
                "https://www.storyflow.dk/api/config":
                  "http://localhost:3000/api/config",
                "https://storyflow-mrvase.vercel.app/api/config":
                  "http://localhost:3000/api/config2",
                "https://kfs-ltc.vercel.app/api/config":
                  "http://localhost:3002/api/config",
                "https://www.paaskelejr.dk/api/config":
                  "http://localhost:3003/api/config",
                "https://semper-magasin.vercel.app/api/config":
                  "http://localhost:3003/api/config",
              }[configUrl] ?? configUrl;
          }

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
        const configs = fetchedConfigs
          .filter(
            (
              el
            ): el is Exclude<
              typeof el,
              PromiseRejectedResult | PromiseFulfilledResult<undefined>
            > => Boolean(el.status === "fulfilled" && el.value)
          )
          .map((el) => el.value);

        setConfigs(Object.fromEntries(configs));
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
