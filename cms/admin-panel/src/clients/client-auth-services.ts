import { Options, createClient } from "@nanorpc/client";
import { isDev } from "../utils/isDev";
import { AuthAPI } from "services-api";
import type { ErrorCodes } from "@storyflow/api";

const url = !isDev ? `/api` : `http://localhost:3000/api`;

const authBaseFetcher = async (key: string, options: Options) => {
  return await fetch(`${url}${key}`, {
    credentials: "include",
    ...options,
  }).then((res) => res.json());
};

export const { query: authServicesQuery, mutate: authServicesMutate } =
  createClient<AuthAPI>("")(authBaseFetcher);
