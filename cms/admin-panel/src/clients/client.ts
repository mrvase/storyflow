import { Options, createClient } from "@nanorpc/client";
import { middleware } from "./middleware";
import type { DefaultAPI, ErrorCodes } from "@storyflow/api";
import { AuthOptions, registerUrlListener } from "./auth";

const baseFetcher = async (
  key: string,
  options: Options & {
    signal: AbortController["signal"];
    headers: Record<string, string>;
  } & AuthOptions
) => {
  const { token, ...rest } = options;
  const protocol = key.startsWith("localhost") ? "http://" : "https://";
  return await fetch(`${protocol}${key}`, {
    ...rest,
    credentials: "include",
    headers: {
      "x-storyflow-token": token,
    },
  }).then((res) => res.json());
};

const fetcher = middleware(baseFetcher);

const options = { url: undefined as string | undefined };
registerUrlListener((newUrl) => (options.url = newUrl ?? undefined));

export const { query, mutate } = createClient<DefaultAPI>(options)(fetcher);
