import React from "react";
import { APIToClient, createClient, createSWRClient } from "@sfrpc/client";
import type { API } from "api";
import type { BucketAPI } from "api/bucket";
import type { CollabAPI } from "api/collab";
import type {} from "@sfrpc/types";
import type {} from "@storyflow/result";
import useSWR, { useSWRConfig } from "swr";
import { useUrlInfo } from "./users";
import { useContextWithError } from "./utils/contextError";
import { useAuth } from "./Auth";

const SWRCache = new Map();
export const provider = () => SWRCache;

const QueryContext = React.createContext<{
  url?: string;
  context?: Record<string, any>;
  headers?: Record<string, string>;
  generateHeaders?: () => Record<string, string>;
}>({});

export const useQueryContext = () => React.useContext(QueryContext);

export type Client = APIToClient<API & BucketAPI & CollabAPI>;

const ClientContext = React.createContext<Client | null>(null);
export const useClient = () => useContextWithError(ClientContext, "Client");

export function readFromCache(key: string) {
  let cached = SWRCache.get(key);
  if (!cached || !cached.data || cached.isLoading === true) {
    return;
  }
  return cached.data;
}

export function QueryContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mutate } = useSWRConfig();

  const { organization, version } = useUrlInfo();

  const { getToken } = useAuth();

  const queryCtx = React.useMemo(
    () => ({
      url: "http://localhost:3000/api",
      context: { slug: organization, version },
      generateHeaders: (): Record<string, string> => {
        const token = getToken();
        if (token) {
          return {
            "X-Storyflow-Token": token,
          };
        }
        return {};
      },
    }),
    [organization]
  );

  const cache = React.useMemo(
    () => ({
      read: readFromCache,
      write(key: string, data: unknown) {
        if (SWRCache.get(key)) return;
        mutate(key, data);
      },
    }),
    []
  );

  const clientCtx = React.useMemo(
    () =>
      createClient<API & BucketAPI & CollabAPI>(queryCtx.url, {
        context: queryCtx.context,
        generateHeaders: queryCtx.generateHeaders,
        cache,
      }),
    [queryCtx]
  );

  return (
    <QueryContext.Provider value={queryCtx}>
      <ClientContext.Provider value={clientCtx}>
        {children}
      </ClientContext.Provider>
    </QueryContext.Provider>
  );
}

// export const client = createClient<API>();

export const SWRClient = createSWRClient<API & BucketAPI & CollabAPI>(
  undefined,
  {
    useSWR,
    useSWRConfig,
    useGlobalOptions: useQueryContext,
  }
);

/*
export const cache = {
  read(key: string) {
    let cached = SWRCache.get(key);
    if (!cached || !cached.data || cached.isLoading === true) {
      return;
    }
    return cached.data;
  },
  write(key: string, data: unknown) {
    // TODO: hvorfor bruger jeg ikke bare mutate, som er reaktiv?
    // fordi den ikke kan findes udenfor et hook.
    let cached = SWRCache.get(key);
    if (!cached) {
      SWRCache.set(key, {
        data,
        isValidating: false,
        isLoading: false,
        error: undefined,
      });
    }
  },
};
*/
