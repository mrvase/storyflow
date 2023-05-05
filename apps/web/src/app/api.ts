import { cache } from "react";
import { options } from "./options";
import { pages } from "@storyflow/api";
import { isError, unwrap } from "@storyflow/result";
import "server-only";

export const getPage = cache(async (url_: string) => {
  const url = url_.startsWith("/") ? url_ : `/${url_}`;
  console.log("CACHED PAGE REQUEST", url);
  try {
    const result = await pages.get.query.call(
      { context: { dbName: "dashboard-w080" } },
      {
        namespaces: options.namespaces,
        url,
      }
    );
    if (isError(result)) {
      return null;
    }
    return unwrap(result);
  } catch (err) {
    return null;
  }
});

export const getPaths = cache(async () => {
  console.log("CACHED PATHS REQUEST");
  try {
    const result = await pages.getPaths.query.call(
      { context: { dbName: "dashboard-w080" } },
      {
        namespaces: options.namespaces,
      }
    );
    if (isError(result)) {
      return [];
    }
    return unwrap(result);
  } catch (err) {
    return [];
  }
});
