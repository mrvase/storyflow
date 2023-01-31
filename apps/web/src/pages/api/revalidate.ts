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

    console.log("PATHS", paths);

    try {
      // This should be the actual path not a rewritten path
      // e.g. for "/blog/[slug]" this should be "/blog/post-1"
      await Promise.all(
        paths.map(async (path) => {
          await res.revalidate(path);
        })
      );
      return res.json({ revalidated: true });
    } catch (err) {
      // If there was an error, Next.js will continue
      // to show the last successfully generated page
      return res.status(500).send("Error revalidating");
    }
  }

  return res.status(200).end();
}
