import { createAPI, createHandler } from "@sfrpc/server";
import type {} from "@sfrpc/types";
import { NextApiRequest, NextApiResponse } from "next";
import { articles } from "./routes/articles";

declare module "@sfrpc/server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}

const api = createAPI({
  articles,
});

export const handler = createHandler(api);

export type API = typeof api;
