import { migration } from "./routes/migration";
import { createAPIRoute as createAPIRoute_ } from "@nanorpc/server/adapters/next";
import { createAPIRouteContext } from "@storyflow/server/next";

export const createAPIRoute = (options: {
  route?: string[];
  secret?: string;
}) =>
  createAPIRoute_(migration, {
    createContext: createAPIRouteContext({
      secret: options.secret,
    }),
    route: options.route,
  });
