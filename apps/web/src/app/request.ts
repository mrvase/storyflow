import { type Result, unwrap } from "@storyflow/result";
import { cache } from "react";
import { config } from "../components";
// import { fetchSinglePage } from "@storyflow/server";

const IS_DEV = process.env.NODE_ENV === "development";

export const request: (
  url: string
) => Promise<{ layout: any | null; page: any | null } | null> = cache(
  async (url: string) => {
    const apiKey = Buffer.from(process.env.API_KEY as string).toString(
      "base64"
    );

    const domain = IS_DEV
      ? "http://localhost:3000"
      : "https://www.storyflow.dk";

    return await fetch(`${domain}/api/public/get`, {
      method: "post",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          url,
          config: [config],
        },
      }),
      credentials: "include",
    }).then(async (res) =>
      unwrap((await res.json()) as Result<{ page: any; layout: any }>, {
        page: null,
        layout: null,
      })
    );
    // return fetchSinglePage(url, "dashboard-625y", [config]);
  }
);
