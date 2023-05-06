import { createAPI, createHandler } from "@storyflow/rpc-server";
import { bucket } from "./bucket";

export const api = createAPI({
  bucket,
});

export const handler = createHandler(api, "bucket");

export type BucketAPI = typeof api;
