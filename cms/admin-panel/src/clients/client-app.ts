import { createClient, Options } from "@nanorpc/client";
import type { AppAPI, ErrorCodes } from "@storyflow/api";
import { middleware } from "./middleware";
import { AuthOptions, registerUrlListener } from "./auth";

const baseFetcher = async (
  key: string,
  options: Options & AuthOptions & { baseURL: string }
) => {
  const { baseURL, token, ...rest } = options;
  return await fetch(key, {
    credentials: "include",
    ...rest,
    headers: {
      "x-storyflow-token": token,
    },
  }).then((res) => res.json());
};

const fetcher = middleware(baseFetcher);

export const { query: appQuery, mutate: appMutate } = createClient<AppAPI>({
  getUrl: (options) => (options.baseURL ? `${options.baseURL}/api` : "/api"),
})(fetcher);
