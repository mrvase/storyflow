import * as React from "react";
import {
  ClientConfig,
  Component,
  ComponentConfig,
  Library,
  LibraryConfig,
} from "@storyflow/frontend/types";

declare module "@storyflow/frontend/types" {
  interface ComponentType<P> {
    (props: P): React.ReactElement<any, any> | null;
  }
}

export const createConfig = (config: ClientConfig) => {
  return config;
};

export const createLibraryConfig = <C extends LibraryConfig>(lib: C): C => {
  return lib;
};

export const createLibrary = <C extends LibraryConfig>(
  lib: Library<C>
): Library<C> => {
  return lib;
};

let LIBRARIES: Library<any>[] | null = null;
let LIBRARY_CONFIGS: LibraryConfig[] | null = null;

export function registerLibraries(libraries: Library<any>[]) {
  LIBRARIES = [
    ...libraries,
    // FALLBACK LIBRARY:
    {
      name: "",
      components: {
        Text: ({ text }) => <p>{text}</p>,
        Outlet: () => (
          <div
            style={{
              padding: "15px",
              textAlign: "center",
              color: "#0005",
              backgroundColor: "#fff",
            }}
          >
            [Outlet]
          </div>
        ),
      },
    },
  ];
}

export const registerLibraryConfigs = (configs: LibraryConfig[]) => {
  LIBRARY_CONFIGS = [...configs];
};

export const getLibraries = () => {
  if (!LIBRARIES) {
    throw new Error("Libraries not registered");
  }
  return LIBRARIES;
};

export const getLibraryConfigs = () => {
  if (!LIBRARY_CONFIGS) {
    throw new Error("Libraries not registered");
  }
  return LIBRARY_CONFIGS;
};

export const getComponentByConfig = (type: string) => {
  const [namespace, name] = type.split(":");
  const configs = getLibraryConfigs();
  const libraries = getLibraries();

  const getComponentFromName = (
    config: LibraryConfig
  ): [Component<ComponentConfig>, ComponentConfig] | undefined => {
    const result = Object.entries(config.components).find(
      ([, el]) => el.name === name
    );

    if (!result) return;

    const [key, componentConfig] = result;

    const library = libraries.find((el) => el.name === config.name)!;
    return [library.components[key]!, componentConfig];
  };

  const namespaceConfig = configs.find((el) => el.name === namespace);

  if (namespaceConfig) {
    const result = getComponentFromName(namespaceConfig);
    if (result) return result;
  }

  for (let i = 0; i < configs.length; i++) {
    let config = configs[i];
    if (config === namespaceConfig) continue;

    const result = getComponentFromName(config);
    if (result) return result;
  }
};

export const getComponentByName = (type: string) => {
  const [namespace, name] =
    type.indexOf(":") >= 0 ? type.split(":") : ["", type];
  const libraries = getLibraries();
  const library = libraries.find((el) => el.name === namespace)!;
  return library.components[name]!;
};

export type { ComponentConfig, Component };

/*
import Outlet from "./Outlet";

export const defaultLibrary = {
  name: "sf",
  label: "Standard",
  components: {
    Outlet,
  },
} satisfies Library<{ [key: string]: React.FC<any> }>;

export const defaultLibraryConfig: LibraryConfig<typeof defaultLibrary> = {
  name: "sf",
  label: "Standard",
  components: {
    Outlet: {
      props: [],
      label: "Outlet",
    },
  },
};
*/
