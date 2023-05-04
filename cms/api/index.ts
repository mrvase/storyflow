import type {} from "@sfrpc/types";
import type {} from "@storyflow/api-core";

import { createAPI, createHandler } from "@sfrpc/server";
import { ai } from "./routes/ai";
import { documents } from "./routes/documents";
import { fields } from "./routes/fields";
import { files } from "./routes/files";
import { folders } from "./routes/folders";
import { ids } from "./routes/ids";

/*
declare module "@sfrpc/server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}
*/

const api = createAPI({
  documents,
  fields,
  folders,
  ids,
  files,
  ai,
});

export const handler = createHandler(api);

export type API = typeof api;
