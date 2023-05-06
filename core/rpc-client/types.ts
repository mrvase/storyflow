import type {
  UnwrapSuccess,
  API,
  MutationObject,
  OptionalParamFunc,
  QueryObject,
} from "@storyflow/rpc-server/types-shared";
export type * from "@storyflow/rpc-server/types-shared";

import type { SWRResponse, SWRConfiguration } from "swr";

export type SharedOptions = {
  context?:
    | Record<string, any>
    | ((prev: Record<string, any>) => Record<string, any>);
};

type CachePreload<
  UserAPI,
  DefaultRoute extends keyof UserAPI,
  APIObject extends { query: any }
> = (
  result: UnwrapSuccess<Awaited<ReturnType<APIObject["query"]>>>,
  preload: <
    Route extends keyof UserAPI = DefaultRoute,
    EP extends keyof UserAPI[Route] = keyof UserAPI[Route]
  >(
    query: [
      key: EP extends string
        ? (Route extends string ? `${Route}/${EP}` : never) | EP
        : never,
      input: UserAPI[Route][EP] extends { query: any }
        ? Parameters<UserAPI[Route][EP]["query"]>[0]
        : undefined
    ],
    callback: EP extends keyof UserAPI[Route]
      ? UserAPI[Route][EP] extends { query: any }
        ? () => UnwrapSuccess<Awaited<ReturnType<UserAPI[Route][EP]["query"]>>>
        : never
      : never
  ) => void
) => void;

export type QueryOptions<
  UserAPI,
  DefaultRoute extends keyof UserAPI,
  APIObject extends { query: any }
> = SharedOptions & {
  cache?: {
    read: (key: string) => unknown | undefined;
    write: (key: string, data: unknown) => void;
  };
  cachePreload?: CachePreload<UserAPI, DefaultRoute, APIObject>;
  throttle?: { key: string; ms: number };
};

type ProcedureCall<
  UserAPI,
  DefaultRoute extends keyof UserAPI,
  APIObject
> = APIObject extends QueryObject<infer Input, infer Output>
  ? {
      key: OptionalParamFunc<Input, string, [options?: SharedOptions]>;
      query: OptionalParamFunc<
        Input,
        Output,
        [options?: QueryOptions<UserAPI, DefaultRoute, APIObject>]
      >;
    }
  : APIObject extends MutationObject<infer Input, infer Output>
  ? {
      mutation: OptionalParamFunc<Input, Output, [options?: SharedOptions]>;
    }
  : never;

export type APIToClient<UserAPI extends API> = {
  [Route in keyof UserAPI]: {
    [Procedure in keyof UserAPI[Route]]: ProcedureCall<
      UserAPI,
      Route,
      UserAPI[Route][Procedure]
    >;
  };
};

export type UseQueryOptions<
  UserAPI,
  DefaultRoute extends keyof UserAPI,
  APIObject extends { query: any }
> = SharedOptions & {
  inactive?: boolean;
  immutable?: boolean;
  cachePreload?: CachePreload<UserAPI, DefaultRoute, APIObject>;
  throttle?: { key: string; ms: number };
} & SWRConfiguration;

export type UseMutationOptions<
  UserAPI,
  DefaultRoute extends keyof UserAPI,
  APIObject extends { mutation: any }
> = SharedOptions & {
  cacheUpdate?: (
    input: Parameters<APIObject["mutation"]>[0],
    mutate: <
      Route extends keyof UserAPI = DefaultRoute,
      EP extends keyof UserAPI[Route] = keyof UserAPI[Route]
    >(
      query: [
        key:
          | (Route extends string
              ? EP extends string
                ? `${Route}/${EP}`
                : never
              : never)
          | EP,
        input: UserAPI[Route][EP] extends { query: any }
          ? Parameters<UserAPI[Route][EP]["query"]>[0]
          : undefined
      ],
      callback: EP extends keyof UserAPI[Route]
        ? UserAPI[Route][EP] extends { query: any }
          ? (
              ps: UnwrapSuccess<
                Awaited<ReturnType<UserAPI[Route][EP]["query"]>>
              >,
              result:
                | UnwrapSuccess<Awaited<ReturnType<APIObject["mutation"]>>>
                | undefined
            ) => UnwrapSuccess<Awaited<ReturnType<UserAPI[Route][EP]["query"]>>>
          : never
        : never
    ) => void
  ) => void;
  options?: {
    rollbackOnError?: boolean;
    revalidate?: boolean;
  };
  onSuccess?: (
    input: Parameters<APIObject["mutation"]>[0],
    result: UnwrapSuccess<Awaited<ReturnType<APIObject["mutation"]>>>
  ) => void;
  onError?: (
    input: Parameters<APIObject["mutation"]>[0],
    error: { message: string; status?: number; detail?: any }
  ) => void;
};

type Hook<UserAPI, Route extends keyof UserAPI, APIObject> = APIObject extends {
  query: any;
}
  ? {
      useQuery: OptionalParamFunc<
        Parameters<APIObject["query"]>[0],
        SWRResponse<
          UnwrapSuccess<Awaited<ReturnType<APIObject["query"]>>>,
          { message: string; error?: any }
        >,
        [options?: UseQueryOptions<UserAPI, Route, APIObject>]
      >;
    }
  : APIObject extends { mutation: any }
  ? {
      useMutation: (
        options?: UseMutationOptions<UserAPI, Route, APIObject>
      ) => OptionalParamFunc<
        Parameters<APIObject["mutation"]>[0],
        ReturnType<APIObject["mutation"]>
      >;
    }
  : never;

export type APIToSWRClient<UserAPI extends API> = {
  [Route in keyof UserAPI]: {
    [Procedure in keyof UserAPI[Route]]: Hook<
      UserAPI,
      Route,
      UserAPI[Route][Procedure]
    >;
  };
};
