import React from "react";
import { APIToClient, createClient, createSWRClient } from "@sfrpc/client";
import type { API } from "api";
import type { BucketAPI } from "api/bucket";
import type { PublicAPI } from "api/public";
import type {} from "@sfrpc/types";
import type {} from "@storyflow/result";
import useSWR, { useSWRConfig } from "swr";
import useSWRImmutable from "swr/immutable";
import { useUrlInfo } from "./users";
import { useContextWithError } from "./utils/contextError";

const SWRCache = new Map();
export const provider = () => SWRCache;

const QueryContext = React.createContext<Record<string, any>>({});
export const useQueryContext = () => React.useContext(QueryContext);

export type Client = APIToClient<API & BucketAPI & PublicAPI>;

const ClientContext = React.createContext<Client | null>(null);
export const useClient = () => useContextWithError(ClientContext, "Client");

const url =
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`;

export function QueryContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mutate } = useSWRConfig();

  const { organization, version } = useUrlInfo();

  const queryCtx = React.useMemo(
    () => ({ slug: organization, version }),
    [organization]
  );

  const cache = React.useMemo(
    () => ({
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
          mutate(key, data);
          /*
        SWRCache.set(key, {
          data,
          isValidating: false,
          isLoading: false,
          error: undefined,
        });
        */
        }
      },
    }),
    []
  );

  const clientCtx = React.useMemo(
    () =>
      createClient<API & BucketAPI & PublicAPI>(url, {
        context: queryCtx,
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

export const SWRClient = createSWRClient<API>(
  url,
  useSWR,
  useSWRImmutable,
  useSWRConfig,
  useQueryContext
);

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
