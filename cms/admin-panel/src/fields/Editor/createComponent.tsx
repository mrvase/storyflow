import { createId } from "@storyflow/backend/ids";
import { LayoutElement } from "@storyflow/backend/types";
import { ComponentConfig, LibraryConfig } from "@storyflow/frontend/types";
import { getComponentType, getConfigFromType } from "../../client-config";

export const createComponent = (
  name: string,
  option:
    | { library: string; config: ComponentConfig }
    | { library: string; libraries: LibraryConfig[] }
): LayoutElement => {
  let config: ComponentConfig | undefined;

  const type = getComponentType(option.library, name);

  if ("libraries" in option) {
    config = getConfigFromType(type, option.libraries);
  } else {
    config = option.config;
  }

  if (!config) {
    return {
      id: createId(1),
      type,
      props: {},
    };
  }

  return {
    id: createId(1),
    type,
    props: Object.fromEntries(config.props.map(({ name }) => [name, []])),
  };
};
