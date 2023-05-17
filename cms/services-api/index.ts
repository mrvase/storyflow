import type {} from "@storyflow/rpc-server/types-shared";
export { createAPIRoute, createRouteHandler } from "@storyflow/server/next";
import { auth } from "./routes/auth";
export { auth } from "./routes/auth";
import { bucket } from "./routes/bucket";
export { bucket } from "./routes/bucket";
import { collab } from "./routes/collab";
export { collab } from "./routes/collab";

export type AuthAPI = { auth: ReturnType<typeof auth> };
export type BucketAPI = { bucket: typeof bucket };
export type CollabAPI = { collab: typeof collab };
