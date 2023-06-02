import { Options, createClient } from "@nanorpc/client";
import { middleware } from "./middleware";
import type { DefaultAPI, ErrorCodes } from "@storyflow/api";
import { AuthOptions } from "./auth";

const baseFetcher = async (
  key: string,
  options: Options & {
    signal: AbortController["signal"];
    headers: Record<string, string>;
  } & AuthOptions
) => {
  const { url, token, ...rest } = options;
  return await fetch(`${url}${key}`, {
    ...rest,
    credentials: "include",
    headers: {
      "x-storyflow-token": token,
    },
  }).then((res) => res.json());
};

const fetcher = middleware(baseFetcher);

/*
export type Client = CreateClient<DefaultAPI, typeof fetcher>;
*/

export const { query, mutate } = createClient<DefaultAPI>("")(fetcher);
