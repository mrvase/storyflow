import { createClient, Options } from "@nanorpc/client";
import type { AppAPI, ErrorCodes } from "@storyflow/api";
import { middleware } from "./middleware";
import { AuthOptions, registerUrlListener } from "./auth";

const baseFetcher = async (
  key: string,
  options: Options & AuthOptions & { baseURL: string }
) => {
  const { baseURL, ...rest } = options;
  return await fetch(`${baseURL}/api${key}`, {
    credentials: "include",
    ...rest,
  }).then((res) => res.json());
};

const fetcher = middleware(baseFetcher);

export const { query: appQuery, mutate: appMutate } =
  createClient<AppAPI>()(fetcher);
