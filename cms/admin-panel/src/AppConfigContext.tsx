import React from "react";
import type { AppConfig, LibraryConfigRecord } from "@storyflow/shared/types";
import { useFolderDomains } from "./folders/FolderDomainsContext";
import { useAuth } from "./Auth";
import { useAppClient } from "./RPCProvider";
import { isError, unwrap } from "@storyflow/rpc-client/result";
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";
import { normalizeProtocol } from "./utils/normalizeProtocol";

const AppConfigContext = React.createContext<Record<string, AppConfig> | null>(
  null
);

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

export const getConfigFromType = (
  type: string,
  configs: LibraryConfigRecord
) => {
  const { library, name } = getInfoFromType(type);
  const config = configs[library];

  if (!config) return;

  const result = config.configs[`${name}Config`];

  return result;
};

const defaultClientConfig: AppConfig = {
  baseURL: "",
  label: "",
  configs: { "": defaultLibraryConfig },
};

const defaultLibraries = { "": defaultLibraryConfig }; // stable reference

export function useAppConfig(key?: string): AppConfig {
  const configs = React.useContext(AppConfigContext);
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
    builderPath: main?.builderPath,
    configs: main?.configs ?? defaultLibraries,
  };
}

export function AppConfigProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { organization } = useAuth();

  const [configs, setConfigs] = React.useState<Record<string, AppConfig>>({});

  const appClient = useAppClient();

  React.useLayoutEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    (async () => {
      const fetchedConfigs = await Promise.all(
        organization!.apps.map(async ({ name, baseURL }) => {
          const normalizedBaseURL = normalizeProtocol(baseURL);
          const result = await appClient.app.config.query(undefined, {
            url: `${normalizedBaseURL}/api`,
          });

          if (isError(result)) {
            return;
          }

          const config = unwrap(result);

          return [
            name,
            {
              ...config,
              baseURL: normalizedBaseURL,
              configs: {
                "": defaultLibraryConfig,
                ...config.configs,
              },
            },
          ] as [string, AppConfig];
        })
      );

      if (isMounted) {
        const configs = fetchedConfigs.filter(
          (el): el is Exclude<typeof el, undefined> => Boolean(el)
        );

        setConfigs(Object.fromEntries(configs));
      }
    })();
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [organization?.apps]);

  return (
    <AppConfigContext.Provider value={configs}>
      {children}
    </AppConfigContext.Provider>
  );
}
