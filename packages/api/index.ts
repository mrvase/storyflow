import { documents } from "./routes/documents";
import { admin } from "./routes/admin";
import { files } from "./routes/files";
import { app } from "./routes/app";
import { ApiConfig, AppConfig, StoryflowConfig } from "@storyflow/shared/types";
import { client } from "./mongo";
import { createRouteHandler as createRouteHandler_ } from "@nanorpc/server/adapters/next";
import { createRouteHandlerContext } from "@storyflow/server/next";

export type * from "@nanorpc/server";

export { isError } from "@nanorpc/server";

const createAPI = (config: StoryflowConfig) => ({
  admin: admin(config),
  documents: documents(config),
  files: files(config),
});

export type DefaultAPI = ReturnType<typeof createAPI>;

export type AppAPI = ReturnType<typeof app>;

export const createLocalAPI = (appConfig: AppConfig, apiConfig: ApiConfig) => {
  client.set(apiConfig.mongoURL);
  return app(appConfig, apiConfig);
};

export type {
  StoryflowConfig,
  AppReference,
  AppConfig,
  ApiConfig,
} from "@storyflow/shared/types";

export const createRouteHandler = (config: StoryflowConfig) => {
  client.set(config.api.mongoURL);
  return createRouteHandler_(createAPI(config), {
    createContext: createRouteHandlerContext({
      secret: config.auth.secret,
    }),
  });
};

/*
export const createAPIRoute = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return createAPIRouteInner(createAPI(config), {
    createContext: createAPIRouteContext({
      secret: config.auth.secret,
    }),
  });
};
*/

export const createAppHandler = (
  appConfig: AppConfig,
  apiConfig: ApiConfig,
  route: string
) => {
  client.set(apiConfig.mongoURL);
  return createRouteHandler_(
    {
      app: app(appConfig, apiConfig),
    },
    {
      createContext: createRouteHandlerContext(),
      route: route ? ["app", route] : ["app"],
    }
  );
};
