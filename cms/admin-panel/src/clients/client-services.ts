import { Options, createClient } from "@nanorpc/client";
import { isDev } from "../utils/isDev";
import { BucketAPI, CollabAPI } from "services-api";
import type { ErrorCodes } from "@storyflow/api";
import { AuthOptions, authMiddleware } from "./auth";

const url = !isDev ? `/api` : `http://localhost:3000/api`;

const baseFetcher = async (key: string, options: Options & AuthOptions) => {
  const { url: organizationUrl, token, ...rest } = options;
  return await fetch(`${url}${key}`, {
    ...rest,
    credentials: "include",
    headers: {
      "x-storyflow-token": token,
    },
  }).then((res) => res.json());
};

export const { query: servicesQuery, mutate: servicesMutate } = createClient<
  BucketAPI & CollabAPI
>("")(authMiddleware(baseFetcher));

/*
export type ServicesClient = CreateClient<
  BucketAPI & CollabAPI,
  typeof baseFetcher
>;
*/
