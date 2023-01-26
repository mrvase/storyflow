import { fetchSinglePage } from "@storyflow/server";
import { cache } from "react";
import { config } from "../components";

export const request: (
  url: string
) => Promise<{ layout: any | null; page: any | null } | null> = cache(
  (url: string) => {
    return fetchSinglePage(url, "dashboard-625y", [config]);
  }
);
