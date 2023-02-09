import { ComponentConfig, LibraryConfig } from "@storyflow/frontend/types";

const parseTypeString = (type: string): [library: string, name: string] => {
  return type.indexOf(":") >= 0
    ? (type.split(":") as [string, string])
    : ["", type];
};

export const getConfigByType = (type: string, configs: LibraryConfig[]) => {
  const [libraryName, name] = parseTypeString(type);

  const getComponentFromLibraryConfig = (
    libraryConfig: LibraryConfig
  ): ComponentConfig | undefined => {
    const result = Object.entries(libraryConfig.components).find(
      ([, el]) => el.name === name
    );

    if (!result) return;

    const [key, componentConfig] = result;

    return {
      ...componentConfig,
      name: libraryConfig.name ? `${libraryConfig.name}:${key}` : key,
    };
  };

  // prioritize libraries with the true name
  // but we always let other libraries overwrite the default library

  const mainLibraryConfigs =
    libraryName === "" ? [] : configs.filter((el) => el.name === libraryName);
  const rest =
    libraryName === ""
      ? configs
      : configs.filter((el) => el.name !== libraryName);

  for (let i = 0; i < mainLibraryConfigs.length; i++) {
    let config = mainLibraryConfigs[i];
    const result = getComponentFromLibraryConfig(config);
    if (result) return result;
  }

  for (let i = 0; i < rest.length; i++) {
    let config = configs[i];
    const result = getComponentFromLibraryConfig(config);
    if (result) return result;
  }
};
