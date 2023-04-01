import { RenderBuilder } from "@storyflow/react/builder";
import { config, library } from "../components";
import { registerLibraries, registerLibraryConfigs } from "@storyflow/react";

registerLibraries([library]);
registerLibraryConfigs([config]);

export default function Builder() {
  return <RenderBuilder />;
}
