import { cache } from "react";
import { createLocalAPI, isError, unwrap } from "@storyflow/api";
import { apiConfig, appConfig } from "../../app.config";
import "server-only";

const api = createLocalAPI(appConfig, apiConfig);

export const getPage = cache(async (url: string) => {
  console.log("CACHED PAGE REQUEST", url);
  try {
    const result = await api.app.getPage.query(url);
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
    const result = await api.app.getPaths.query();
    if (isError(result)) {
      return [];
    }
    return unwrap(result);
  } catch (err) {
    return [];
  }
});
