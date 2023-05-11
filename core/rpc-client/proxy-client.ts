import { error, isError, isSuccess, success, unwrap } from "./result";
import type { API } from "./types";
import type { APIToClient, QueryOptions, SharedOptions } from "./types";
import { dedupedFetch } from "./dedupedFetch";
import { externalKey, getContext, mutationKey, queryKey } from "./utils";

export const proxyErrorMessage = "client proxy not accessed correctly";

const query = (
  key: string,
  options: {
    headers?: Record<string, string>;
    generateHeaders?: () => Record<string, string>;
    throttle?: { key: string; ms: number };
  } = {}
) => {
  const abortController = new AbortController();

  const getResult = async () => {
    try {
      const response = await dedupedFetch.fetch(key, {
        abortController,
        ...options,
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

export const mutation = (
  route: string,
  input: any,
  options: {
    headers?: Record<string, string>;
    generateHeaders?: () => Record<string, string>;
  } = {}
) => {
  const abortController = new AbortController();

  const getResult = async () => {
    try {
      const response = await fetch(route, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ query: input }),
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          ...options.generateHeaders?.(),
        },
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
  apiUrlFromArg?: string,
  globalOptions: {
    context?: Record<string, any>;
    headers?: Record<string, string>;
    generateHeaders?: () => Record<string, string>;
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
                options?: Pick<QueryOptions<any, any, any>, "context"> & {
                  url?: string;
                }
              ) {
                const apiUrl = options?.url ?? apiUrlFromArg;
                if (!apiUrl) throw new Error("No API URL provided");

                return queryKey(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  getContext(options?.context, globalOptions.context)
                );
              },
              async query(
                input: any,
                options?: QueryOptions<any, any, any> & { url?: string }
              ) {
                const apiUrl = options?.url ?? apiUrlFromArg;
                if (!apiUrl) throw new Error("No API URL provided");

                const ctx = getContext(options?.context, globalOptions.context);

                const key = queryKey(
                  `${apiUrl}/${route}/${procedure}`,
                  input,
                  ctx
                );

                const cache = options?.cache ?? globalOptions.cache;

                if (cache) {
                  const cached = cache.read(key);
                  if (typeof cached !== "undefined") {
                    return success(cached);
                  }
                }

                let fetcher = query;

                if (cache) {
                  fetcher = (key, globalOptions) => {
                    const promise = query(key, globalOptions);
                    const result = promise.then((result) => {
                      if (isError(result)) return result;

                      if (options?.cachePreload) {
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

                      cache.write(key, unwrap(result));

                      return result;
                    });

                    return Object.assign(result, {
                      abort: promise.abort,
                    });
                  };
                }

                return fetcher(key, globalOptions);
              },
              mutation(input: any, options?: SharedOptions & { url?: string }) {
                const apiUrl = options?.url ?? apiUrlFromArg;
                if (!apiUrl) throw new Error("No API URL provided");

                return mutation(
                  mutationKey(
                    `${apiUrl}/${route}/${procedure}`,
                    getContext(options?.context, globalOptions.context)
                  ),
                  input,
                  globalOptions
                );
              },
            };
          },
        }
      );
    },
  });
}