import React from "react";
import { isError, unwrap } from "./result";
import type { API } from "./types";
import type { SWRHook } from "swr";
import type { FullConfiguration, ScopedMutator } from "swr/_internal";
import { dedupedFetch } from "./dedupedFetch";
import type {
  APIToSWRClient,
  UseMutationOptions,
  UseQueryOptions,
} from "./types";
import { externalKey, getContext, mutationKey, queryKey } from "./utils";
import { mutation, proxyErrorMessage } from "./proxy-client";

const extendMutate = (
  mutate: ScopedMutator<any>,
  promise: Promise<any>,
  apiUrl: string,
  apiRoute: string,
  ctx: any,
  {
    rollbackOnError = true,
    revalidate = false,
  }: {
    rollbackOnError?: boolean;
    revalidate?: boolean;
  } = {}
) => {
  return ([externalProcedure, input]: [string, any], callback: any) => {
    mutate(
      externalKey(
        {
          apiUrl,
          route: apiRoute,
          externalProcedure,
        },
        input,
        ctx
      ),
      async (ps: any) => {
        const result = await promise;
        if (isError(result)) {
          throw new Error(result.message);
        }
        return callback(ps, unwrap(result));
      },
      {
        revalidate,
        optimisticData: (ps: any) => {
          return callback(ps, undefined);
        },
        rollbackOnError,
      }
    );
  };
};

const SWRFetcher = async (
  key: string,
  options: {
    throttle?: { key: string; ms: number };
    headers?: Record<string, string>;
    generateHeaders?: () => Record<string, string>;
  } = {}
) => {
  const result = await dedupedFetch.fetch(key, options);
  if (isError(result)) {
    throw result;
  }
  return unwrap(result);
};

export function createSWRClient<UserAPI extends API>(
  apiUrlFromArg: string | undefined,
  hooks: {
    useSWR: SWRHook;
    useSWRConfig: () => FullConfiguration;
    useGlobalOptions?: () => {
      url?: string;
      context?: Record<string, any>;
      headers?: Record<string, string>;
      generateHeaders?: () => Record<string, string>;
    };
  }
) {
  return new Proxy({} as APIToSWRClient<UserAPI>, {
    get(_, route) {
      if (typeof route !== "string") throw new Error(proxyErrorMessage);
      return new Proxy(
        {},
        {
          get(_, procedure) {
            if (typeof procedure !== "string")
              throw new Error(proxyErrorMessage);
            return {
              useQuery: (
                input: any,
                {
                  inactive,
                  immutable,
                  context,
                  cachePreload,
                  throttle,
                  ...SWROptions
                }: UseQueryOptions<any, any, any> = {}
              ) => {
                const globalOptions = hooks.useGlobalOptions?.() ?? {};
                const apiUrl = apiUrlFromArg ?? globalOptions.url ?? "/api";

                let fetcher = React.useCallback(
                  (key: string) => {
                    return SWRFetcher(key, { throttle, ...globalOptions });
                  },
                  [throttle?.key, throttle?.ms, globalOptions]
                );

                if (cachePreload) {
                  const { cache, mutate } = hooks.useSWRConfig();

                  fetcher = React.useCallback(
                    async (key) => {
                      const result = await SWRFetcher(key, {
                        throttle,
                        ...globalOptions,
                      });

                      if (result !== undefined) {
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
                            globalOptions.context
                          );

                          let cached = cache.get(key);
                          if (!cached) {
                            mutate(key, data);
                            /*
                            cache.set(key, {
                              data,
                              isValidating: false,
                              isLoading: false,
                              error: undefined,
                            });
                            */
                          }
                        };

                        cachePreload(result, preloadFunc);
                      }

                      return result;
                    },
                    [cache, throttle?.key, throttle?.ms]
                  );
                }

                if (immutable) {
                  SWROptions.revalidateOnFocus = false;
                  SWROptions.revalidateIfStale = false;
                  SWROptions.revalidateOnReconnect = false;
                }

                return hooks.useSWR(
                  () =>
                    inactive
                      ? undefined
                      : queryKey(
                          `${apiUrl}/${route}/${procedure}`,
                          input,
                          getContext(context, globalOptions.context)
                        ),
                  fetcher,
                  SWROptions
                );
              },
              useMutation: (
                options: UseMutationOptions<any, any, any> = {}
              ) => {
                const globalOptions = hooks.useGlobalOptions?.() ?? {};
                const apiUrl = apiUrlFromArg ?? globalOptions.url ?? "/api";

                const { mutate } = hooks.useSWRConfig();

                return async (input: any) => {
                  const promise = mutation(
                    mutationKey(
                      `${apiUrl}/${route}/${procedure}`,
                      getContext(options.context, globalOptions.context)
                    ),
                    input,
                    globalOptions
                  );

                  if (options.cacheUpdate) {
                    const mutator: any = extendMutate(
                      mutate,
                      promise,
                      apiUrl,
                      route,
                      getContext(options.context, globalOptions.context),
                      options.options
                    );
                    options.cacheUpdate(input, mutator);
                  }

                  const result = await promise;

                  if (isError(result)) {
                    options.onError?.(input, {
                      status: result.status,
                      message: result.message,
                      detail: result.detail,
                    });
                  } else {
                    options.onSuccess?.(input, unwrap(result));
                  }

                  return result;
                };
              },
            };
          },
        }
      );
    },
  });
}
