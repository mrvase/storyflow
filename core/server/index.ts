import type { NextApiRequest, NextApiResponse } from "next";

declare module "@storyflow/rpc-server" {
  interface CustomTypes {
    Request: NextApiRequest;
    Response: NextApiResponse;
  }
}
