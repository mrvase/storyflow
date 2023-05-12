import type {
  LibraryConfigRecord,
  NestedDocumentId,
  NestedElement,
} from "@storyflow/shared/types";
import type { Config } from "@storyflow/shared/types";
import { getComponentType, getConfigFromType } from "../../AppConfigContext";

export const createComponent = (
  id: NestedDocumentId,
  name: string,
  option:
    | { library: string; config: Config }
    | { library: string; configs: LibraryConfigRecord }
): NestedElement => {
  let config: Config | undefined;

  const element = getComponentType(option.library, name);

  if ("configs" in option) {
    config = getConfigFromType(element, option.configs);
  } else {
    config = option.config;
  }

  if (!config) {
    return {
      id,
      element,
    };
  }

  return {
    id,
    element,
    ...(config.inline && { inline: true }),
  };
};
