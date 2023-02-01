import {
  ClientConfig,
  Component,
  ComponentConfig,
  ExtendedLibraryConfig,
  ExtendedPartialConfig,
  Library,
  LibraryConfig,
  PartialConfig,
  PropConfig,
  Props,
  Story,
} from "@storyflow/frontend/types";
import * as React from "react";

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

export const createComponent = <T extends readonly PropConfig[]>(
  component: ExtendedPartialConfig<T>["component"],
  config: PartialConfig<T>
): ExtendedPartialConfig<T> => {
  return {
    ...config,
    component,
  };
};

export const createFullConfig = <T extends ExtendedLibraryConfig>(
  config: T
) => {
  const entries = Object.entries(config.components);
  const componentConfigs: any = {};
  const components: any = {};
  const stories = [];

  const extendedName = ([key, el]: [string, ExtendedPartialConfig<any>]) => {
    return el.typespace ? `${el.typespace}/${el.name ?? key}` : el.name ?? key;
  };

  const getName = (componentConfig: ExtendedPartialConfig<any>) => {
    return entries.find(([, value]) => value === componentConfig)?.[0];
  };

  const handleImports: any = (props: any) => {
    return Object.fromEntries(
      Object.entries(props).map(([key, value]) => {
        if (Array.isArray(value)) {
          return [
            key,
            {
              $children: value.map((el: any) => {
                if (typeof el !== "object") return el;

                return {
                  id: "",
                  type: el.typespace
                    ? `${config.name}:${el.typespace}/${getName(el)}`
                    : `${config.name}:${getName(el)}`,
                  props: handleImports(el.stories?.[0]?.props ?? {}),
                };
              }),
            },
          ];
        }
        return [key, value];
      })
    );
  };

  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const [
      key,
      { component, typespace, stories, name, label, props, ...rest },
    ] = entry;

    componentConfigs[key] = {
      ...rest,
      name: extendedName(entry),
      label: label ?? name ?? key,
      props: props.map((prop: any) => {
        if (typeof prop.options === "object") {
          const newEntries = Object.entries(prop.options);
          newEntries.forEach((el) => {
            if (!entries.some((existing) => existing[1] === el[1])) {
              entries.push(el as any);
            }
          });
          return {
            ...prop,
            options: Object.entries(prop.options).map(
              ([key, value]: [string, any]) =>
                value.typespace
                  ? `${config.name}:${value.typespace}/${key}`
                  : `${config.name}:${key}`
            ),
          };
        }
        return prop;
      }),
    };

    components[key] = component;

    i++;
  }

  i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const [key, { stories: newStories, name, label }] = entry;

    if (newStories) {
      const arr: any[] = newStories.map((story, index) => ({
        name: `${config.name}_${name ?? key}_${index}`,
        label: story.label ?? label ?? key,
        canvas: story.canvas ?? "",
        page: [
          {
            id: "root",
            type: `${config.name}:${key}`,
            props: handleImports(story.props),
          },
        ],
      }));

      stories.push(...arr);
    }

    i++;
  }

  return [
    createLibraryConfig({
      name: config.name,
      label: config.label,
      components: componentConfigs,
    }),
    createLibrary({
      name: config.name,
      components,
    }),
    {
      name: config.name,
      stories,
    } as { name: string; stories: Story[] },
  ] as const;
};

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

export type { ComponentConfig, PartialConfig, Props };

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
