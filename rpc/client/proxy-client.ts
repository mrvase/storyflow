import { error, isError, isSuccess, success, unwrap } from "@storyflow/result";
import type { API } from "@sfrpc/types";
import { APIToClient, QueryOptions, SharedOptions } from "./types";
import { dedupedFetch } from "./dedupedFetch";
import { externalKey, getContext, queryKey } from "./utils";

export const proxyErrorMessage = "client proxy not accessed correctly";

const query = (key: string, throttle?: { key: string; ms: number }) => {
  const abortController = new AbortController();

  const getResult = async () => {
    try {
      const response = await dedupedFetch.fetch(key, {
        abortController,
        throttle,
      });
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
  globalOptions: {
    context?: Record<string, any>;
    cache?: {
      read: (key: string) => unknown;
      write: (key: string, value: unknown) => void;
    };
  } = {}
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
              key(
                input: any,
                options?: Pick<QueryOptions<any, any, any>, "context">
              ) {
                return queryKey(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  getContext(options?.context, globalOptions.context)
                );
              },
              async query(input: any, options?: QueryOptions<any, any, any>) {
                const ctx = getContext(options?.context, globalOptions.context);

                const key = queryKey(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  ctx
                );

                const cache = options?.cache ?? globalOptions?.cache;

                if (cache) {
                  const cached = cache.read(key);
                  if (typeof cached !== "undefined") {
                    return success(cached);
                  }
                }

                let fetcher = query;

                if (options?.cachePreload && cache) {
                  fetcher = (key) => {
                    const result = query(key, options?.throttle).then(
                      (result) => {
                        if (isSuccess(result)) {
                          const preloadFunc = (
                            [externalProcedure, input]: [string, any],
                            data: any
                          ) => {
                            const key = externalKey(
                              {
                                apiUrl,
                                route,
                                externalProcedure,
                              },
                              input,
                              ctx
                            );

                            let cached = cache.read(key);
                            if (!cached) {
                              cache.write(key, data);
                            }
                          };

                          options.cachePreload?.(unwrap(result), preloadFunc);
                        }

                        return result;
                      }
                    );

                    return Object.assign(result, {
                      abort: (query as unknown as { abort: () => void }).abort,
                    });
                  };
                }

                const result = await fetcher(key);

                if (cache && !isError(result)) {
                  cache.write(key, unwrap(result));
                }

                return result;
              },
              mutation(input: any, options?: SharedOptions) {
                return mutation(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  getContext(options?.context, globalOptions.context)
                );
              },
            };
          },
        }
      );
    },
  });
}
