import { createAPI } from "@storyflow/rpc-server";
import { createAPIRoute } from "@storyflow/server/next";
import { bucket } from "./bucket";

export const api = createAPI({
  bucket,
});

export const handler = createAPIRoute(api, "bucket");

export type BucketAPI = typeof api;
