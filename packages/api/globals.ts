import { procedure, auth, cors } from "@storyflow/server/rpc";

import { ApiConfig } from "@storyflow/shared/types";

export const globals = (config: ApiConfig) =>
  procedure.use(cors(config.cors ?? [])).use(auth(config.publicKey));
