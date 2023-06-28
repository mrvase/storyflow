import { createAppHandler } from "@storyflow/api";
import { apiConfig, appConfig } from "../../../app.config";

export const { POST, OPTIONS } = createAppHandler(
  appConfig,
  apiConfig,
  "submit"
);
