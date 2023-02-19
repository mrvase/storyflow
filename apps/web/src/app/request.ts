import { type Result, unwrap } from "@storyflow/result";
import { config } from "../components";
// import { fetchSinglePage } from "@storyflow/server";

const IS_DEV = process.env.NODE_ENV === "development";

/*
export const request: (
  url: string
) => Promise<{ layout: any | null; page: any | null } | null> = cache(
  async (url: string) => {
    return fetchSinglePage(url, "dashboard-625y", [config]);
  }
);
*/
const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
const domain = IS_DEV ? "http://localhost:3000" : "https://www.storyflow.dk";

export const request = async (url: string) => {
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
        namespace: process.env.NAMESPACE ?? "",
      },
    }),
    credentials: "include",
  }).then(async (res) => {
    try {
      const json = await res.json();
      return unwrap(
        json as Result<{ page: any; layout: any; head: any } | null>,
        {
          page: null,
          layout: null,
          head: null,
        }
      );
    } catch (err) {
      console.error(err);
    }
    return {
      page: null,
      layout: null,
      head: null,
    };
  });
};

export const requestPaths = async () => {
  return await fetch(
    `${domain}/api/public/getPaths?query=${process.env.NAMESPACE ?? ""}`,
    {
      method: "get",
      headers: {
        Authorization: `Basic ${apiKey}`,
      },
      credentials: "include",
    }
  ).then(async (res) => {
    try {
      const json = await res.json();
      return unwrap(json as Result<string[]>, [] as string[]);
    } catch (err) {
      console.error(err);
    }
    return [] as string[];
  });
};
