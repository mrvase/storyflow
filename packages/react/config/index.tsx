import {
  ClientConfig,
  ComponentConfig,
  ExtendedLibraryConfig,
  ExtendedPartialConfig,
  Library,
  LibraryConfig,
  PartialConfig,
  ComponentProps,
  Story,
  StoryConfig,
  StoryProps,
  PropConfigArray,
  StoryLibrary,
  ExtendedOptions,
} from "@storyflow/frontend/types";
import * as React from "react";
import { cms } from "../src/CMSElement";
import { createRenderArray } from "@storyflow/frontend/render";
import { getConfigByType } from "./getConfigByType";

declare module "@storyflow/frontend/types" {
  interface ComponentType<P> {
    (props: P): React.ReactElement<any, any> | null;
  }
  interface CustomTypes {
    Element: React.ReactElement;
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
      return <cms.p>{children}</cms.p>;
    },
    H1: ({ children }: any) => {
      return <cms.h1>{children}</cms.h1>;
    },
    H2: ({ children }: any) => {
      return <cms.h2>{children}</cms.h2>;
    },
    H3: ({ children }: any) => {
      return <cms.h3>{children}</cms.h3>;
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
        { name: "label", type: "string", label: "Label" },
        { name: "href", type: "string", label: "URL" },
      ],
      inline: true,
    },
    Loop: {
      label: "Loop",
      name: "loop",
      props: [
        { name: "children", type: "children", label: "Indhold" },
        { name: "data", type: "children", label: "Data" },
      ],
    },
  },
};

export const registerLibraryConfigs = (configs: LibraryConfig[]) => {
  LIBRARY_CONFIGS = [...configs, defaultLibraryConfig];
};

export const createComponent = <T extends PropConfigArray<ExtendedOptions>>(
  component: ExtendedPartialConfig<T>["component"],
  config: PartialConfig<T>
): ExtendedPartialConfig<T> => {
  return {
    ...config,
    component,
  };
};

function modifyValues<T extends object>(
  obj: T,
  callback: (value: T[keyof T], key: string) => any
) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, callback(value, key)])
  );
}

export function modifyChild<T extends PropConfigArray<ExtendedOptions>>(
  child: ExtendedPartialConfig<T>,
  props: number | StoryProps<T>,
  overwritingProps?: StoryProps<T>
):
  | ExtendedPartialConfig<T>
  | {
      config: ExtendedPartialConfig<T>;
      story: StoryConfig<T>;
    } {
  if (typeof props === "number") {
    if (!child.stories || child.stories.length <= props) return child;
    return {
      config: child,
      story: {
        ...child.stories[props],
        props: { ...child.stories[props].props, ...overwritingProps },
      },
    };
  }
  return { config: child, story: { props } };
}

export const createFullConfig = <T extends ExtendedLibraryConfig>(
  config: T
): [LibraryConfig, Library, StoryLibrary] => {
  const entries = Object.entries(config.components);
  const componentConfigs: any = {};
  const components: any = {};
  const stories: any = {};

  const extendedName = ([key, el]: [string, ExtendedPartialConfig<any>]) => {
    return el.typespace ? `${el.typespace}/${el.name ?? key}` : el.name ?? key;
  };

  const getName = (componentConfig: ExtendedPartialConfig<any>) => {
    return entries.find(([, value]) => value === componentConfig)?.[0];
  };

  const handleImports = (
    props: StoryProps<any>,
    libraries: LibraryConfig[]
  ): any => {
    return modifyValues(props, (value) => {
      if (Array.isArray(value)) {
        return {
          $children: createRenderArray(
            value.map((el) => {
              if (typeof el !== "object") return el;

              const createName = (
                componentConfig: ExtendedPartialConfig<any>
              ) => {
                return componentConfig.typespace
                  ? `${config.name}:${componentConfig.typespace}/${getName(
                      componentConfig
                    )}`
                  : `${config.name}:${getName(componentConfig)}`;
              };

              let type = "";
              let props = {};

              if ("story" in el && "config" in el) {
                type = createName(el.config);
                props = el.story.props;
              } else {
                type = createName(el);
                props = el.stories?.[0]?.props ?? {};
              }

              return {
                id: "",
                type,
                props: handleImports(props, libraries),
              };
            }),
            (type: string) => Boolean(getConfigByType(type, libraries)?.inline)
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
        if (typeof prop.options === "object" && !Array.isArray(prop.options)) {
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
      stories[key] = newStories.map((story, index) => ({
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
      components: stories,
    } as { name: string; components: Record<string, Story[]> },
  ];
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

export type { ComponentConfig, PartialConfig, ComponentProps };
