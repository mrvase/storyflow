import React from "react";
import { APIToClient, createClient, createSWRClient } from "@sfrpc/client";
import type { API } from "api";
import type {} from "@sfrpc/types";
import type {} from "@storyflow/result";
import useSWR, { useSWRConfig } from "swr";
import { useOrganisationSlug } from "./users";
import { useContextWithError } from "./utils/contextError";

const QueryContext = React.createContext<Record<string, any>>({});
export const useQueryContext = () => React.useContext(QueryContext);

export type Client = APIToClient<API>;

const ClientContext = React.createContext<Client | null>(null);
export const useClient = () => useContextWithError(ClientContext, "Client");

const url =
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`;

export function QueryContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const slug = useOrganisationSlug();

  const queryCtx = React.useMemo(() => ({ slug }), [slug]);

  const clientCtx = React.useMemo(
    () => createClient<API>(url, queryCtx),
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

const SWRCache = new Map();
export const provider = () => SWRCache;

// export const client = createClient<API>();
export const SWRClient = createSWRClient<API>(
  url,
  useSWR,
  useSWRConfig,
  useQueryContext
);

export const useCache = {
  read(key: string) {
    let cached = SWRCache.get(key);
    if (!cached || !cached.data || cached.isLoading === true) {
      return;
    }
    return cached.data;
  },
  write(key: string, data: unknown) {
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
