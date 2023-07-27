import React from "react";
import type {
  AppConfig,
  AppReference,
  LibraryConfigRecord,
} from "@storyflow/shared/types";
import { useFolderDomains } from "./folders/FolderDomainsContext";
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";
import { normalizeProtocol } from "./utils/normalizeProtocol";
import { useOrganization } from "./clients/auth";
import { appQuery } from "./clients/client-app";
import { isError } from "@nanorpc/client";
import useSWRImmutable from "swr/immutable";

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

export const fetchConfigs = async (apps: AppReference[]) => {
  const fetchedConfigs = await Promise.all(
    apps.map(async ({ name, baseURL }) => {
      const normalizedBaseURL = normalizeProtocol(baseURL);
      const config = await appQuery.config(undefined, {
        baseURL: normalizedBaseURL,
      });

      if (isError(config)) {
        return;
      }

      return [
        name,
        {
          ...config,
          baseURL: normalizedBaseURL,
          configs: {
            ...config.configs,
            "": defaultLibraryConfig,
          },
        },
      ] as [string, AppConfig];
    })
  );

  const configs: Record<string, AppConfig> = {};

  fetchedConfigs.forEach((config) => {
    config && (configs[config[0]] = config[1]);
  });

  return configs;
};

const defaultClientConfig: AppConfig = {
  baseURL: "",
  mainBaseURL: "",
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

  if (!main) {
    return {
      baseURL: "",
      mainBaseURL: "",
      label: "",
      builderPath: undefined,
      configs: defaultLibraries,
    };
  }

  return {
    baseURL: main.baseURL,
    mainBaseURL: main.mainBaseURL,
    label: main.label,
    builderPath: main.builderPath,
    configs: main.configs,
  };
}

export function AppConfigProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const organization = useOrganization();

  const { data: configs = {} } = useSWRImmutable(
    `${organization!.slug}/configs`,
    () => fetchConfigs(organization!.apps)
  );

  return (
    <AppConfigContext.Provider value={configs}>
      {children}
    </AppConfigContext.Provider>
  );
}
