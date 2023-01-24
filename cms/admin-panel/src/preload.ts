import { queryKey } from "@sfrpc/client";
import { unwrap } from "@storyflow/result";
import React from "react";
import { provider, useClient, useQueryContext } from "./client";

let preloaded = false;

export function Preload() {
  const client = useClient();

  const ctx = useQueryContext();

  React.useLayoutEffect(() => {
    const cache = provider();
    const id = "--0a";
    if (!preloaded) {
      preloaded = true;
      (async () => {
        const data = await client.articles.getList.query(id);
        const result = unwrap(data);
        if (result) {
          result.articles.forEach((article) => {
            const key = queryKey(
              `http://localhost:3001/api/articles/get`,
              article.id,
              ctx
            );
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
