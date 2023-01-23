import type { UnwrapResult } from "@storyflow/result";
import type {
  API,
  MutationObject,
  OptionalParamFunc,
  QueryObject,
} from "@sfrpc/types";
import type { SWRResponse } from "swr";

export type SharedOptions = {
  context?:
    | Record<string, any>
    | ((prev: Record<string, any>) => Record<string, any>);
};

export type QueryOptions<Output> = SharedOptions & {
  useCache?: {
    read: (key: string) => Output | undefined;
    write: (key: string, data: Output) => void;
  };
};

type ProcedureCall<APIObject> = APIObject extends QueryObject<
  infer Input,
  infer Output
>
  ? {
      query: OptionalParamFunc<
        Input,
        Output,
        [options?: QueryOptions<UnwrapResult<Awaited<Output>>>]
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
      UserAPI[Route][Procedure]
    >;
  };
};

export type UseQueryOptions = SharedOptions & {
  inactive?: boolean;
  refreshInterval?: number;
};

export type UseMutationOptions<
  UserAPI,
  Route extends keyof UserAPI,
  APIObject extends { mutation: any }
> = SharedOptions & {
  cacheUpdate?: (
    input: Parameters<APIObject["mutation"]>[0],
    mutate: <EP extends keyof UserAPI[Route]>(
      query: [
        key: EP,
        input: UserAPI[Route][EP] extends { query: any }
          ? Parameters<UserAPI[Route][EP]["query"]>[0]
          : undefined
      ],
      callback: EP extends keyof UserAPI[Route]
        ? UserAPI[Route][EP] extends { query: any }
          ? (
              ps: UnwrapResult<
                Awaited<ReturnType<UserAPI[Route][EP]["query"]>>
              >,
              result:
                | UnwrapResult<Awaited<ReturnType<APIObject["mutation"]>>>
                | undefined
            ) => UnwrapResult<Awaited<ReturnType<UserAPI[Route][EP]["query"]>>>
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
    result: UnwrapResult<Awaited<ReturnType<APIObject["mutation"]>>>
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
          UnwrapResult<Awaited<ReturnType<APIObject["query"]>>>,
          { message: string; error?: any }
        >,
        [options?: UseQueryOptions]
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
