import type {} from "@sfrpc/types";
import type {} from "@storyflow/server";

import { createAPI, createHandler } from "@sfrpc/server";
import { documents } from "./routes/documents";
import { admin } from "./routes/admin";
import { files } from "./routes/files";
import { pages } from "./routes/pages";
import { StoryflowConfig } from "@storyflow/shared/types";
import { setClientPromise } from "./mongoClient";

const api = (config: StoryflowConfig) =>
  createAPI({
    admin: admin(config),
    documents: documents(config),
    files: files(config),
    pages: pages(config),
  });

export const handler = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return createHandler(api(config));
};

export type API = ReturnType<typeof api>;

export { pages } from "./routes/pages";

export const pagesHandler = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return createHandler(createAPI({ pages: pages(config) }), "pages");
};

export type PagesAPI = typeof api;

export type {
  StoryflowConfig,
  AppReference,
  AppConfig,
} from "@storyflow/shared/types";
