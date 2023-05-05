import React from "react";
import type {
  AppConfig,
  ComponentConfig,
  LibraryConfig,
} from "@storyflow/shared/types";
import { SWRClient } from "./client";
import { useFolderDomains } from "./folders/FolderDomainsContext";
import { useAuth } from "./Auth";

const ClientConfigContext = React.createContext<Record<
  string,
  AppConfig
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
      label: "Generer fra data",
      name: "Loop",
      props: [
        { name: "children", type: "children", label: "Indhold" },
        { name: "data", type: "data", label: "Data" },
      ],
    },
  },
};

const defaultClientConfig: AppConfig = {
  baseURL: "",
  label: "",
  builderPath: "",
  revalidatePath: "",
  libraries: [defaultLibrary],
};

const defaultLibraries = [defaultLibrary]; // stable reference

export function useAppConfig(key?: string): AppConfig {
  const configs = React.useContext(ClientConfigContext);
  const domains = useFolderDomains();
  if (!configs) {
    throw new Error("useAppConfig cannot find provider.");
  }

  if (key) {
    return configs[key] ?? defaultClientConfig;
  }

  if (!domains) {
    throw new Error("useAppConfig must be used within a FolderPage");
  }

  // TODO should return union of all config libraries

  if (!Object.keys(configs ?? []).length) {
    return defaultClientConfig;
  }

  const main = configs[domains[0]];

  return {
    baseURL: main?.baseURL ?? "",
    label: main?.label ?? "",
    builderPath: main?.builderPath ?? "",
    revalidatePath: main?.revalidatePath ?? "",
    libraries: main?.libraries ?? defaultLibraries,
  };
}

export function ClientConfigProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { organization } = useAuth();

  const [configs, setConfigs] = React.useState<Record<string, AppConfig>>({});

  React.useLayoutEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    (async () => {
      const fetchedConfigs = await Promise.allSettled(
        organization!.apps.map(async ({ name, configURL }) => {
          const config = await fetch(configURL, {
            signal: abortController.signal,
          }).then((res) => res.json() as Promise<AppConfig>);

          return [
            name,
            {
              ...config,
              libraries: [defaultLibrary, ...config.libraries],
            },
          ] as [string, AppConfig];
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
  }, [organization?.apps]);

  return (
    <ClientConfigContext.Provider value={configs}>
      {children}
    </ClientConfigContext.Provider>
  );
}
