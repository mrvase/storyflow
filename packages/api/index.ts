import type {} from "@storyflow/rpc-server/types-shared";
import type {} from "@storyflow/server";

import { createAPI, createHandler } from "@storyflow/rpc-server";
import { documents } from "./routes/documents";
import { admin } from "./routes/admin";
import { files } from "./routes/files";
import { pages as _pages } from "./routes/pages";
import { StoryflowConfig } from "@storyflow/shared/types";
import { setClientPromise } from "./mongoClient";

const api = (config: StoryflowConfig) =>
  createAPI({
    admin: admin(config),
    documents: documents(config),
    files: files(config),
    pages: _pages(config),
  });

export const handler = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return createHandler(api(config));
};

export type API = ReturnType<typeof api>;

export const pages = (config: StoryflowConfig) => {
  setClientPromise(config.api.mongoURL);
  return _pages(config);
};

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

export * from "@storyflow/rpc-server/result";
