import { Options, Fetcher } from "@nanorpc/client";
import { SWRMiddleware } from "@nanorpc/client/swr";
import { AuthOptions, authMiddleware } from "./auth";
import type { ErrorCodes } from "@storyflow/api";

const prettifyMiddleware = <TOptions>(fetcher: Fetcher<TOptions>) => {
  return async (
    key: string,
    options: { [Key in keyof TOptions]: TOptions[Key] } & {}
  ) => {
    return await fetcher(key, options);
  };
};

export const middleware = <TOptions extends Options & AuthOptions>(
  fetcher: Fetcher<TOptions>
) => {
  return prettifyMiddleware(
    authMiddleware(throttleMiddleware(SWRMiddleware(fetcher)))
  );
};

export type Result<TQuery extends (...args: any) => any> = Exclude<
  Awaited<ReturnType<TQuery>>,
  ErrorCodes<string>
>;

function createPromise<T>() {
  let props: {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } = {} as any;
  const promise = new Promise((res, rej) => {
    props.resolve = res;
    props.reject = rej;
  }) as Promise<T> & typeof props;
  Object.assign(promise, props);
  return promise;
}

function createThrottledFetch<T>(
  fetcher: (key: string) => Promise<T>,
  duration: number = 250
) {
  let key: string | null = null;
  let promise: ReturnType<typeof createPromise<T>> | null = null;
  let result: T | null = null;

  let currentFetch: string | null = null;

  const runFetch = async () => {
    if (!key || !promise) return;
    let fetchId = Math.random().toString(16).slice(2);
    currentFetch = fetchId;
    const newResult = await fetcher(key);
    if (currentFetch === fetchId) {
      promise.resolve(newResult);
      result = newResult;
      promise = null;
    }
  };

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const updatePlannedFetch = (newKey: string) => {
    if (promise) {
      promise.reject("aborted");
    }
    if (timeout) {
      clearTimeout(timeout);
    }
    key = newKey;
    promise = createPromise();
    timeout = setTimeout(() => {
      runFetch();
      timeout = null;
    }, duration);
    return promise;
  };

  return {
    fetch(newKey: string) {
      if (key === newKey && (result || promise)) {
        return result || promise;
      }
      return updatePlannedFetch(newKey);
    },
  };
}

export const throttleMiddleware = <TOptions>(fetcher: Fetcher<TOptions>) => {
  const THROTTLED: Record<
    string,
    ReturnType<typeof createThrottledFetch<any>>
  > = {};

  return async (
    key: string,
    options: TOptions & { throttle?: { key: string; ms: number } }
  ) => {
    const { throttle, ...rest } = options;

    if (throttle) {
      if (!(throttle.key in THROTTLED)) {
        THROTTLED[throttle.key] = createThrottledFetch(
          (key) => fetcher(key, rest as TOptions),
          throttle.ms
        );
      }
      const result = await THROTTLED[throttle.key].fetch(key);
      if (throttle.key in THROTTLED) {
        delete THROTTLED[throttle.key];
      }
      return result;
    }
    return await fetcher(key, rest as TOptions);
  };
};
