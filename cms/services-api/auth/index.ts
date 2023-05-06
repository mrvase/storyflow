import { createAPI, createHandler } from "@storyflow/rpc-server";
import type {} from "@storyflow/rpc-server/types-shared";
import { auth } from "./auth";

export const api = createAPI({
  auth,
});

export const handler = createHandler(api, "auth");

export type AuthAPI = typeof api;
