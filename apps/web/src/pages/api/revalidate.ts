import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("REVALIDATION");
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

  if (req.method === "POST") {
    const paths = req.body as string[];

    try {
      await Promise.all(paths.map((path) => res.revalidate(path)));
      res.status(200).json({ revalidated: true });
    } catch (err) {
      console.log("REVALIDATION ERROR", err);
      res.status(500).json({ revalidated: false });
    }
  } else if (req.method === "OPTIONS") {
    res.status(200);
  } else {
    res.status(405);
  }

  return res.end();
}
