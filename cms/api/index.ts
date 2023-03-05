import { createAPI, createHandler } from "@sfrpc/server";
import type {} from "@sfrpc/types";
import { NextApiRequest, NextApiResponse } from "next";
import { ai } from "./routes/ai";
import { articles } from "./routes/articles";
import { files } from "./routes/files";
import { folders } from "./routes/folders";
import { ids } from "./routes/ids";
import { settings } from "./routes/settings";

declare module "@sfrpc/server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}

const api = createAPI({
  articles,
  folders,
  ids,
  settings,
  files,
  ai,
});

export const handler = createHandler(api);

export type API = typeof api;
