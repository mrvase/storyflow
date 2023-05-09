import type {} from "@storyflow/rpc-server/types-shared";
import { createAPIRoute, createRouteHandler } from "@storyflow/server/next";

import { documents } from "./routes/documents";
import { admin } from "./routes/admin";
import { files } from "./routes/files";
import { app } from "./routes/app";
import { ApiConfig, AppConfig, StoryflowConfig } from "@storyflow/shared/types";
import { setClientPromise } from "./mongoClient";

const createAPI = (config: StoryflowConfig) => ({
  admin: admin(config),
  documents: documents(config),
  files: files(config),
});

export type DefaultAPI = ReturnType<typeof createAPI>;

export type AppAPI = { app: ReturnType<typeof app> };

export const createHandler = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return createRouteHandler(createAPI(config), { secret: config.auth.secret });
};

export const createLocalAPI = (appConfig: AppConfig, apiConfig: ApiConfig) => {
  setClientPromise(apiConfig.mongoURL);
  return {
    app: app(appConfig, apiConfig),
  };
};

export const createAppHandler = (
  appConfig: AppConfig,
  apiConfig: ApiConfig,
  procedure?: string
) => {
  setClientPromise(apiConfig.mongoURL);
  return createRouteHandler(
    {
      app: app(appConfig, apiConfig),
    },
    {
      route: "app",
      procedure,
    }
  );
};

export type {
  StoryflowConfig,
  AppReference,
  AppConfig,
  ApiConfig,
} from "@storyflow/shared/types";

export * from "@storyflow/rpc-server/result";
