import { registerLibraries, registerLibraryConfigs } from "@storyflow/react";
import { RenderBuilder } from "@storyflow/react/builder";
import { config, library } from "../components";

registerLibraries([library]);
registerLibraryConfigs([config]);

export default function Builder() {
  return <RenderBuilder />;
}
