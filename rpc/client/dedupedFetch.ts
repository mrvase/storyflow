const GET_OPTIONS = {
  method: "GET",
  credentials: "include",
} as const;

const createDedupedFetcher = () => {
  const FETCH: Record<string, Promise<any>> = {};
  return {
    fetch: async (key: string, abortController?: AbortController) => {
      if (!(key in FETCH)) {
        FETCH[key] = fetch(key, {
          ...GET_OPTIONS,
          ...(abortController && { signal: abortController.signal }),
        }).then((data) => data.json());
      }
      const result = await FETCH[key];
      setTimeout(() => {
        // allow cache to be set and catch anteceding fetches
        if (key in FETCH) delete FETCH[key];
      });
      return result;
    },
    delete: (key: string) => key in FETCH && delete FETCH[key],
  };
};

export const dedupedFetch = createDedupedFetcher();
