import { error, isError, isSuccess, success, unwrap } from "@storyflow/result";
import type { API } from "@sfrpc/types";
import { APIToClient, QueryOptions, SharedOptions } from "./types";
import { dedupedFetch } from "./dedupedFetch";
import { getContext, queryKey } from "./utils";

export const proxyErrorMessage = "client proxy not accessed correctly";

const query = (key: string) => {
  const abortController = new AbortController();

  const getResult = async () => {
    try {
      const response = await dedupedFetch.fetch(key, abortController);
      if (response.status >= 400) {
        return error({ message: "Fetch failed", detail: "status code" });
      }
      if (!isSuccess(response)) {
        return error({
          message: "The JSON response is not in the correct format.",
          detail: response,
        });
      }
      return response;
    } catch (err) {
      console.error(err);
      return error({ message: "Fetch failed", detail: err });
    }
  };

  const promise = Object.assign(getResult(), {
    abort: () => {
      dedupedFetch.delete(key);
      abortController.abort();
    },
  });

  return promise;
};

export const mutation = (route: string, input: any, context?: any) => {
  const abortController = new AbortController();

  const getResult = async () => {
    try {
      const response = await fetch(route, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ query: input, ...(context && { context }) }),
        headers: { "Content-Type": "application/json" },
      });
      if (response.status >= 400) {
        return error({ message: "Fetch failed", detail: "status code" });
      }
      return await response.json();
    } catch (err) {
      console.error(err);
      return error({ message: "Fetch failed", detail: err });
    }
  };

  const promise = Object.assign(getResult(), {
    abort: () => abortController.abort(),
  });

  return promise;
};

export function createClient<T extends API>(
  apiUrl: string = "/api",
  ctx?: Record<string, any>
) {
  return new Proxy({} as APIToClient<T>, {
    get(_, route) {
      if (typeof route !== "string") throw new Error("");
      return new Proxy(
        {},
        {
          get(_, procedure) {
            if (typeof procedure !== "string")
              throw new Error(proxyErrorMessage);
            return {
              query: async (input: any, options?: QueryOptions<any>) => {
                const key = queryKey(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  getContext(options?.context, ctx)
                );
                if (options?.useCache) {
                  const cached = options.useCache.read(key);
                  if (typeof cached !== "undefined") {
                    return success(cached);
                  }
                }
                const result = await query(key);
                if (options?.useCache && !isError(result)) {
                  options.useCache.write(key, unwrap(result));
                }
                return result;
              },
              mutation: (input: any, options?: SharedOptions) => {
                return mutation(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  getContext(options?.context, ctx)
                );
              },
            };
          },
        }
      );
    },
  });
}
