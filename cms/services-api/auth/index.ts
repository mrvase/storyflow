import { createAPI } from "@storyflow/rpc-server";
import type {} from "@storyflow/rpc-server/types-shared";
import { createAPIRoute } from "@storyflow/server/next";
import { auth } from "./auth";

export const api = createAPI({
  auth,
});

export const handler = createAPIRoute(api, "auth");

export type AuthAPI = typeof api;
