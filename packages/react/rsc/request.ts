import { FetchPageResult } from "@storyflow/frontend/types";

const IS_DEV = process.env.NODE_ENV === "development";

const domain = IS_DEV ? "http://localhost:3000" : "http://localhost:3000";

const getNamespacesQuery = (namespaces: string[]) => {
  return namespaces.map((n) => `query[namespaces][]=${n}`).join("&") ?? "";
};

let offset: number | null = null;

const getTime = () => {
  const time = new Date().getTime();
  if (offset === null) {
    offset = time % 5000;
  }
  return Math.floor((time - offset) / 5000).toString();
};

type Options = { key: string; namespaces: string[] };

export const request = async (url: string, options: Options) => {
  const fetchUrl = `${domain}/api/public/get?${getNamespacesQuery(
    options.namespaces
  )}&query[url]=${url}`;
  const time = getTime();
  console.log("FETCHING", domain, url, time);
  try {
    const res = await fetch(fetchUrl, {
      headers: {
        "x-storyflow": options.key,
        "x-storyflow-timestamp": time,
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
      return result;
    } else {
      return null;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const requestPaths = async (options: Options) => {
  const time = getTime();
  console.log("FETCHING PATHS", domain, time);
  try {
    const res = await fetch(
      `${domain}/api/public/getPaths?${getNamespacesQuery(options.namespaces)}`,
      {
        headers: new Headers({
          "x-storyflow": options.key,
          "x-storyflow-timestamp": time,
        }),
      }
    );
    const json = await res.json();
    console.log("PATH JSON", json);
    if (
      json !== null &&
      typeof json === "object" &&
      "success" in json &&
      json.success === true
    ) {
      return json.result as string[];
    }
  } catch (err) {
    console.log("FETCHING PATHS FAILED");
    console.error(err);
  }
  return [] as string[];
};
