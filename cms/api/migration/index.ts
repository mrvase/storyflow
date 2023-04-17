import { createAPI, createHandler } from "@sfrpc/server";
import { migration } from "./migration";

export const api = createAPI({
  migration,
});

export const handler = createHandler(api, "migration");

export type MigrationAPI = typeof api;
