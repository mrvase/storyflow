import type { Router } from "@nanorpc/server";
import {
  createAPIRoute as createAPIRoute_,
  createRouteHandler as createRouteHandler_,
} from "@nanorpc/server/adapters/next";
import { auth } from "./routes/auth";
export { auth } from "./routes/auth";
import { bucket } from "./routes/bucket";
export { bucket } from "./routes/bucket";
import { collab } from "./routes/collab";
import {
  createAPIRouteContext,
  createRouteHandlerContext,
} from "@storyflow/server/next";
export { collab } from "./routes/collab";

export type AuthAPI = { auth: ReturnType<typeof auth> };
export type BucketAPI = { bucket: typeof bucket };
export type CollabAPI = { collab: typeof collab };

export const createRouteHandler = (
  api: Router,
  options: { secret?: string }
) => {
  return createRouteHandler_(api, {
    createContext: createRouteHandlerContext(options),
  });
};

export const createAPIRoute = (api: Router, options: { secret?: string }) => {
  return createAPIRoute_(api, {
    createContext: createAPIRouteContext(options),
  });
};
