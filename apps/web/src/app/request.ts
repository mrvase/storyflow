import { FetchPageResult, resolveFetchPageResult } from "@storyflow/react";
import { config } from "../components";

const IS_DEV = process.env.NODE_ENV === "development";

const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
const domain = IS_DEV
  ? "http://localhost:3000"
  : "https://storyflow-mrvase.vercel.app/";

export const request = async (url: string) => {
  const fetchUrl = `${domain}/api/public/get?query[namespace]=${
    process.env.NAMESPACE ?? ""
  }&query[url]=${url}`;
  console.log("FETCHING", fetchUrl);
  try {
    const res = await fetch(fetchUrl, {
      method: "GET",
      cache: "force-cache",
      headers: new Headers({
        "x-storyflow": apiKey,
      }),
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
  console.log("REQUESTING PATHS");
  try {
    const res = await fetch(
      `${domain}/api/public/getPaths?query=${process.env.NAMESPACE ?? ""}`,
      {
        method: "GET",
        cache: "force-cache",
        headers: new Headers({
          "x-storyflow": apiKey,
        }),
      }
    );
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
};
