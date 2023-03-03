import { FetchPageResult, resolveFetchPageResult } from "@storyflow/react";
import { config } from "../components";

const IS_DEV = process.env.NODE_ENV === "development";

const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
const domain = IS_DEV ? "http://localhost:3000" : "http://www.storyflow.dk";

export const request = async (url: string) => {
  const fetchUrl = `${domain}/api/public/get?query[namespace]=${
    process.env.NAMESPACE ?? ""
  }&query[url]=${url}`;
  console.log("FETCHING", fetchUrl);
  try {
    const res = await fetch(fetchUrl, {
      headers: {
        "x-storyflow": apiKey,
      },
    });
    const json = await res.json();
    if (
      json !== null &&
      typeof json === "object" &&
      "success" in json &&
      json.success === true
    ) {
      const result = json.result as FetchPageResult | null;
      if (!result) return null;
      return resolveFetchPageResult(result, [config]);
    }
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const requestPaths = async () => {
  return await fetch(
    `${domain}/api/public/getPaths?query=${process.env.NAMESPACE ?? ""}`,
    {
      method: "get",
      cache: "force-cache",
      headers: {
        "x-storyflow": apiKey,
      },
    }
  ).then(async (res) => {
    try {
      const json = await res.json();
      if (
        json !== null &&
        typeof json === "object" &&
        "success" in json &&
        json.success === true
      ) {
        return json.result as string[];
      }
    } catch (err) {
      console.error(err);
    }
    return [] as string[];
  });
};
