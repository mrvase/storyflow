const GET_OPTIONS = {
  method: "GET",
  credentials: "include",
} as const;

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

const createDedupedFetcher = () => {
  const FETCH: Record<string, Promise<any>> = {};
  const THROTTLED: Record<
    string,
    ReturnType<typeof createThrottledFetch<any>>
  > = {};

  const fetcher = async (key: string, abortController?: AbortController) => {
    if (!(key in FETCH)) {
      FETCH[key] = fetch(key, {
        ...GET_OPTIONS,
        ...(abortController && {
          signal: abortController.signal,
        }),
      }).then((data) => data.json());
    }
    const result = await FETCH[key];
    setTimeout(() => {
      // allow cache to be set and catch anteceding fetches
      if (key in FETCH) delete FETCH[key];
    });
    return result;
  };

  const throttledFetcher = async (
    key: string,
    throttle: { key: string; ms: number },
    abortController?: AbortController
  ) => {
    if (!(throttle.key in THROTTLED)) {
      THROTTLED[throttle.key] = createThrottledFetch(
        (key) => fetcher(key, abortController),
        throttle.ms
      );
    }
    const result = await THROTTLED[throttle.key].fetch(key);
    if (throttle.key in THROTTLED) {
      delete THROTTLED[throttle.key];
    }
    return result;
  };

  return {
    fetch: async (
      key: string,
      options: {
        abortController?: AbortController;
        throttle?: { key: string; ms: number };
      } = {}
    ) => {
      if (options.throttle) {
        return throttledFetcher(key, options.throttle, options.abortController);
      }
      return fetcher(key, options.abortController);
    },
    delete: (key: string) => key in FETCH && delete FETCH[key],
  };
};

export const dedupedFetch = createDedupedFetcher();
