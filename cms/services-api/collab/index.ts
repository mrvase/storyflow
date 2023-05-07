import { createAPI } from "@storyflow/rpc-server";
import { createAPIRoute } from "@storyflow/server/next";
import type {} from "@storyflow/rpc-server/types-shared";
import { collab } from "./collab";

export const api = createAPI({
  collab,
});

export const handler = createAPIRoute(api, "collab");

export type CollabAPI = typeof api;
