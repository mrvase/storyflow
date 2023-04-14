import React from "react";
import { isError, unwrap } from "@storyflow/result";
import type { API } from "@sfrpc/types";
import type { SWRHook } from "swr";
import type { FullConfiguration, ScopedMutator } from "swr/_internal";
import { dedupedFetch } from "./dedupedFetch";
import { APIToSWRClient, UseMutationOptions, UseQueryOptions } from "./types";
import { externalKey, getContext, queryKey } from "./utils";
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
  throttle?: { key: string; ms: number }
) => {
  const result = await dedupedFetch.fetch(key, { throttle });
  if (isError(result)) {
    throw result;
  }
  return unwrap(result);
};

export function createSWRClient<UserAPI extends API>(
  apiUrl: string = "/api",
  useSWR: SWRHook,
  useSWRImmutable: SWRHook,
  useSWRConfig: () => FullConfiguration,
  useContext?: () => Record<string, any>
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
                const ctx = useContext?.();

                let fetcher = React.useCallback(
                  (key: string) => {
                    return SWRFetcher(key, throttle);
                  },
                  [throttle?.key, throttle?.ms]
                );

                if (cachePreload) {
                  const { cache, mutate } = useSWRConfig();

                  fetcher = React.useCallback(
                    async (key) => {
                      const result = await SWRFetcher(key, throttle);

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
                            ctx
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

                const hook = immutable ? useSWRImmutable : useSWR;

                return hook(
                  () =>
                    inactive
                      ? undefined
                      : queryKey(
                          `${apiUrl}/${route}/${procedure}`,
                          input,
                          getContext(context, ctx)
                        ),
                  fetcher,
                  SWROptions
                );
              },
              useMutation: (
                options: UseMutationOptions<any, any, any> = {}
              ) => {
                const ctx = useContext?.();
                const { mutate } = useSWRConfig();

                return async (input: any) => {
                  const promise = mutation(
                    `${apiUrl}/${route}/${procedure}`,
                    input,
                    getContext(options.context, ctx)
                  );

                  if (options.cacheUpdate) {
                    const mutator: any = extendMutate(
                      mutate,
                      promise,
                      apiUrl,
                      route,
                      getContext(options.context, ctx),
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
