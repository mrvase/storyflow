import type {} from "@sfrpc/types";
import type {} from "@storyflow/api-core";

import { createAPI, createHandler } from "@sfrpc/server";
import { public_ } from "./public";

/*
declare module "@sfrpc/server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}
*/

export const api = createAPI({
  public: public_,
});

export const handler = createHandler(api, "public");

export type PublicAPI = typeof api;
