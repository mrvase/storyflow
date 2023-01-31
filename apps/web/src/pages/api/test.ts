import { NextApiRequest, NextApiResponse } from "next";

export default async function (req: NextApiRequest, res: NextApiResponse) {
  const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
  const result = await fetch(
    `http://localhost:3000/api/public/get?query=priser`,
    {
      headers: {
        authorization: `Basic ${apiKey}`,
      },
      credentials: "include",
    }
  ).then((res) => res.json());

  res.status(200).json(result);
}
