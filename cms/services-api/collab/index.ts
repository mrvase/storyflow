import { createAPI, createHandler } from "@sfrpc/server";
import type {} from "@sfrpc/types";
import { collab } from "./collab";

export const api = createAPI({
  collab,
});

export const handler = createHandler(api, "collab");

export type CollabAPI = typeof api;
