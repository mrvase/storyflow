import React from "react";
import {
  APIToClient,
  createClient,
  createSWRClient,
} from "@storyflow/rpc-client";
import type { API } from "@storyflow/api";
import type { BucketAPI } from "services-api/bucket";
import type { CollabAPI } from "services-api/collab";
import type {} from "@storyflow/rpc-client/types-shared";
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

export type Client = APIToClient<API>;
export type ServicesClient = APIToClient<BucketAPI & CollabAPI>;

const ClientContext = React.createContext<Client | null>(null);
export const useClient = () => useContextWithError(ClientContext, "Client");

const servicesUrl = "http://localhost:3000/api";

const ServicesClientContext = React.createContext<ServicesClient | null>(null);
export const useServicesClient = () =>
  useContextWithError(ServicesClientContext, "Client");

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

  const { organization: slug, version } = useUrlInfo();

  const { getToken, apiUrl, organization } = useAuth();

  const queryCtx = React.useMemo(
    () => ({
      url: apiUrl!, // is certainly known here because it is set when signed in
      context: { slug, version },
      generateHeaders: (): Record<string, string> => {
        const token = getToken();
        return token
          ? {
              "X-Storyflow-Token": token,
            }
          : {};
      },
    }),
    [slug, apiUrl]
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
      createClient<API>(queryCtx.url, {
        context: queryCtx.context,
        generateHeaders: queryCtx.generateHeaders,
        cache,
      }),
    [queryCtx]
  );

  const servicesClientCtx = React.useMemo(
    () =>
      createClient<CollabAPI & BucketAPI>(servicesUrl, {
        context: queryCtx.context,
        generateHeaders: queryCtx.generateHeaders,
        cache,
      }),
    [queryCtx]
  );

  return (
    <QueryContext.Provider value={queryCtx}>
      <ClientContext.Provider value={clientCtx}>
        <ServicesClientContext.Provider value={servicesClientCtx}>
          {organization ? children : null}
        </ServicesClientContext.Provider>
      </ClientContext.Provider>
    </QueryContext.Provider>
  );
}

export const SWRClient = createSWRClient<API & BucketAPI & CollabAPI>(
  undefined,
  {
    useSWR,
    useSWRConfig,
    useGlobalOptions: useQueryContext,
  }
);
