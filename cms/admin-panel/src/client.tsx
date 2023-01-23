import { createSWRClient } from "@sfrpc/client";
import useSWR, { useSWRConfig } from "swr";
import type { API } from "api";
import type {} from "@sfrpc/types";
import type {} from "@storyflow/result";

const SWRCache = new Map();
export const provider = () => SWRCache;

// export const client = createClient<API>();
export const SWRClient = createSWRClient<API>(
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`,
  useSWR,
  useSWRConfig
);
