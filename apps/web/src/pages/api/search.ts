import { unwrap } from "@storyflow/result";
import { NextApiRequest, NextApiResponse } from "next";

const IS_DEV = process.env.NODE_ENV === "development";
const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
const domain = IS_DEV ? "http://localhost:3000" : "https://www.storyflow.dk";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const result = await fetch(`${domain}/api/public/search`, {
        method: "post",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: req.query.query,
        }),
        credentials: "include",
      }).then(async (res) => {
        try {
          const json = await res.json();
          return unwrap(json);
        } catch (err) {
          console.error(err);
        }
        return [];
      });
      return res.json(result);
    } catch (err) {
      return res.status(500).send("Error searching");
    }
  }

  return res.status(200).end();
}
