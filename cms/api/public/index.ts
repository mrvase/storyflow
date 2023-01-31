import { createAPI, createHandler } from "@sfrpc/server";
import { public_ } from "./public";

export const api = createAPI({
  public: public_,
});

export const handler = createHandler(api, "public");

export type PublicAPI = typeof api;
