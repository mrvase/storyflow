import { createAPI, createHandler } from "@storyflow/rpc-server";
import type {} from "@storyflow/rpc-server/types-shared";
import { collab } from "./collab";

export const api = createAPI({
  collab,
});

export const handler = createHandler(api, "collab");

export type CollabAPI = typeof api;
