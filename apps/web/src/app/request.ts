import { FetchPageResult } from "@storyflow/react";

/*
const IS_DEV = process.env.NODE_ENV === "development";

const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");
const domain = IS_DEV ? "http://localhost:3000" : "https://www.storyflow.dk";

const namespacesQuery =
  process.env.NAMESPACES?.split(",")
    .map((n) => `query[namespaces][]=${n}`)
    .join("&") ?? "";

export const request = async (url: string) => {
  const fetchUrl = `${domain}/api/public/get?${namespacesQuery}&query[url]=${url}`;
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
      console.log("FETCH RESULT", result);
      return result;
    } else {
      return null;
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
      `${domain}/api/public/getPaths?${namespacesQuery}`,
      {
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
*/
