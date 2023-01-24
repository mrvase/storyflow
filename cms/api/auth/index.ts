import { createAPI, createHandler } from "@sfrpc/server";
import { users } from "./users";

export const api = createAPI({
  users,
});

export const handler = createHandler(api, "users");

export type UserAPI = typeof api;
