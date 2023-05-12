import {
  Component,
  Config,
  ConfigRecord,
  Library,
  LibraryConfig,
} from "@storyflow/shared/types";

const parseTypeString = (type: string): [library: string, name: string] => {
  return type.indexOf(":") >= 0
    ? (type.split(":") as [string, string])
    : ["", type];
};

export function getConfigByType(
  type: string,
  {
    configs,
    libraries,
    options,
  }: {
    configs: Record<string, LibraryConfig>;
    libraries?: Record<string, Library>;
    options?: ConfigRecord;
  }
): { config?: Config; component?: Component<Config["props"]> } {
  const [libraryName, name] = parseTypeString(type);

  const libraryConfig = configs[libraryName];
  let config = libraryConfig?.configs?.[`${name}Config`];

  if (!config && options) {
    config = options[`${name}Config`];
  }

  let component = config?.component;

  if (libraries && config && !component) {
    const library = libraries[libraryName];
    component = library[name];
  }

  return { config, component };
}
