import { createAPI, createHandler } from "@sfrpc/server";
import { collab } from "./collab";

export const api = createAPI({
  collab,
});

export const handler = createHandler(api, "collab");

export type CollabAPI = typeof api;
