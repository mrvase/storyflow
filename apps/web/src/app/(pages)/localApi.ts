import { cache } from "react";
import { createLocalAPI, isError } from "@storyflow/api";
import type { ErrorCodes } from "@storyflow/api";
import { apiConfig, appConfig } from "../../app.config";
import "server-only";

const api = createLocalAPI(appConfig, apiConfig);

export const getPage = cache(async (url: string) => {
  console.log("CACHED PAGE REQUEST", url);
  try {
    const result = await api.getPage(url);
    if (isError(result)) {
      return null;
    }
    return result;
  } catch (err) {
    return null;
  }
});

export const getPaths = cache(async () => {
  console.log("CACHED PATHS REQUEST");
  try {
    const result = await api.getPaths();
    if (isError(result)) {
      return [];
    }
    return result;
  } catch (err) {
    return [];
  }
});

export const getLoopWithOffset = async ({
  url,
  id,
}: {
  url: string;
  id: string;
}) => {
  try {
    const result = await api.getLoopWithOffset({ url, id });
    if (isError(result)) {
      return null;
    }
    return result;
  } catch (err) {
    return null;
  }
};
