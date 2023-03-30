import { NestedDocumentId, NestedElement } from "@storyflow/backend/types";
import { ComponentConfig, LibraryConfig } from "@storyflow/frontend/types";
import { getComponentType, getConfigFromType } from "../../client-config";

export const createComponent = (
  id: NestedDocumentId,
  name: string,
  option:
    | { library: string; config: ComponentConfig }
    | { library: string; libraries: LibraryConfig[] }
): NestedElement => {
  let config: ComponentConfig | undefined;

  const element = getComponentType(option.library, name);

  if ("libraries" in option) {
    config = getConfigFromType(element, option.libraries);
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
