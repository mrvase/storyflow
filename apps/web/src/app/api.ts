import { cache } from "react";
import { pages } from "@storyflow/api";
import { isError, unwrap } from "@storyflow/result";
import "server-only";
import { storyflowConfig } from "../config";

const api = pages(storyflowConfig);
const namespaces = process.env.NAMESPACES?.split(",") ?? [];

export const getPage = cache(async (url_: string) => {
  const url = url_.startsWith("/") ? url_ : `/${url_}`;
  console.log("CACHED PAGE REQUEST", url);
  try {
    const result = await api.get.query.call(
      { context: { dbName: "dashboard-w080" } },
      {
        namespaces,
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
    const result = await api.getPaths.query.call(
      { context: { dbName: "dashboard-w080" } },
      {
        namespaces,
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
