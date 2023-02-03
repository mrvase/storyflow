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
import { cms } from "../src/CMSElement";
import { createRenderArray } from "./createRenderArray";

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

const defaultLibrary = {
  name: "",
  components: {
    Text: ({ children }: any) => {
      return <p>{children}</p>;
    },
    H1: ({ children }: any) => {
      return <h1>{children}</h1>;
    },
    H2: ({ children }: any) => {
      return <h2>{children}</h2>;
    },
    H3: ({ children }: any) => {
      return <h3>{children}</h3>;
    },
    Outlet: () => (
      <cms.div
        style={{
          padding: "15px",
          textAlign: "center",
          color: "#0005",
          backgroundColor: "#fff",
        }}
      >
        [Outlet]
      </cms.div>
    ),
    Link: ({ href, label }: { href?: string; label?: String }) => {
      return <cms.a href={`/${href ?? ""}`}>{label}</cms.a>;
    },
  },
};

export function registerLibraries(libraries: Library<any>[]) {
  LIBRARIES = [
    ...libraries,
    // FALLBACK LIBRARY:
    defaultLibrary,
  ];
}

const defaultLibraryConfig: LibraryConfig = {
  name: "",
  label: "Default",
  components: {
    Outlet: {
      label: "Outlet",
      name: "Outlet",
      props: [],
    },
    Link: {
      label: "Link",
      name: "Link",
      props: [
        { name: "href", type: "string", label: "URL" },
        { name: "label", type: "string", label: "Label" },
      ],
      inline: true,
    },
  },
};

export const registerLibraryConfigs = (configs: LibraryConfig[]) => {
  LIBRARY_CONFIGS = [...configs, defaultLibraryConfig];
};

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

  const handleImports = (props: any, libraries: LibraryConfig[]): any => {
    const modifyValues = (
      obj: any,
      callback: (value: any, key: string) => any
    ) => {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, callback(value, key)])
      );
    };

    return modifyValues(props, (value) => {
      if (Array.isArray(value)) {
        return {
          $children: createRenderArray(
            value.map((el: any) => {
              if (typeof el !== "object") return el;

              return {
                id: "",
                type: el.typespace
                  ? `${config.name}:${el.typespace}/${getName(el)}`
                  : `${config.name}:${getName(el)}`,
                props: handleImports(el.stories?.[0]?.props ?? {}, libraries),
              };
            }),
            libraries
          ),
        };
      }
      return value;
    });
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
              entries.push([
                el[0],
                Object.assign(el[1] as any, { hidden: true }),
              ]);
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

  const libraryConfig = createLibraryConfig({
    name: config.name,
    label: config.label,
    components: componentConfigs,
  });

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
            props: handleImports(story.props, [
              libraryConfig,
              defaultLibraryConfig,
            ]),
          },
        ],
      }));

      stories.push(...arr);
    }

    i++;
  }

  return [
    libraryConfig,
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

export type { ComponentConfig, PartialConfig, Props };
