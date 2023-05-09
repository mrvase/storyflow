import { createAppHandler } from "@storyflow/api";
import { apiConfig, appConfig } from "../../../../app.config";

export const { GET, OPTIONS } = createAppHandler(
  appConfig,
  apiConfig,
  "config"
);
