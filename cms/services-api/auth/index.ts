import { createAPI, createHandler } from "@sfrpc/server";
import type {} from "@sfrpc/types";
import { auth } from "./auth";

export const api = createAPI({
  auth,
});

export const handler = createHandler(api, "auth");

export type AuthAPI = typeof api;
