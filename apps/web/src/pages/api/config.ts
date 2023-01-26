import { NextApiRequest, NextApiResponse } from "next";
import { createConfig } from "@storyflow/react/config";
import { config } from "../../components";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    req.headers.origin &&
    ["https://www.storyflow.dk"]
      .concat(
        process.env.NODE_ENV === "development" ? ["http://localhost:5173"] : []
      )
      .includes(req.headers.origin)
  ) {
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  }
  res
    .status(200)
    .json(
      createConfig({
        builderUrl: "http://localhost:3000/builder",
        libraries: [config],
      })
    );
}
