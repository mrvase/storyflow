import {
  PropConfigRecord,
  Config,
  Component,
  ConfigRecord,
  LibraryConfig,
} from "@storyflow/shared/types";

export { RenderHead } from "./src/RenderHead";
export { ParseRichText } from "./src/ParseRichText";
export { cms, CMSElement } from "./src/CMSElement";

export type {
  LibraryConfig,
  Library,
  Props,
  Story,
  Stories,
  PropConfigRecord,
  Config,
  LibraryConfigRecord,
  LibraryRecord,
  ConfigRecord,
} from "@storyflow/shared/types";

export type { FetchPageResult } from "@storyflow/client/types";

export const withComponent = <T extends PropConfigRecord>(
  component: Component<T>,
  config: Omit<Config<T>, "component">
) =>
  ({
    ...config,
    component,
  } satisfies Config<T>);

type Prettify<T> = { [Key in keyof T]: T[Key] } & {};

type ComponentsFromConfig<T extends ConfigRecord> = {
  [Key in keyof T as T[Key] extends { component: any }
    ? Key extends `${infer Name}Config`
      ? Name
      : never
    : never]: T[Key] extends { component: any } ? T[Key]["component"] : never;
};

export function extractLibrary<T extends LibraryConfig>(
  config: T
): Prettify<ComponentsFromConfig<T["configs"]>> {
  return Object.fromEntries(
    Object.entries(config.configs).reduce((acc, [key, value]) => {
      if ("component" in value && value.component) {
        acc.push([key.replace(/Config$/, ""), value.component]);
      }
      return acc;
    }, [] as [string, Component<any>][])
  ) as ComponentsFromConfig<T["configs"]>;
}
