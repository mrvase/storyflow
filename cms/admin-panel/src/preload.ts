import { queryKey } from "@sfrpc/client";
import { unwrap } from "@storyflow/result";
import React from "react";
import { provider, useClient, useQueryContext } from "./client";

let preloaded = false;

const API_URL =
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`;

const TEMPLATE_FOLDER_ID = "---0";

export function Preload() {
  const client = useClient();

  const ctx = useQueryContext();

  React.useLayoutEffect(() => {
    const cache = provider();
    if (!preloaded) {
      preloaded = true;
      (async () => {
        const data = await client.articles.getList.query(TEMPLATE_FOLDER_ID);
        const result = unwrap(data);
        if (result) {
          result.articles.forEach((article) => {
            const key = queryKey(`${API_URL}/articles/get`, article.id, ctx);
            const exists = cache.get(key);
            if (!exists) {
              cache.set(key, {
                data: {
                  article,
                  histories: {},
                },
                isValidating: false,
                isLoading: false,
                error: undefined,
              });
            }
          });
        }
      })();
    }
  }, []);

  return null;
}
