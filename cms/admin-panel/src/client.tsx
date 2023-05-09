import React from "react";
import {
  APIToClient,
  createClient,
  createSWRClient,
} from "@storyflow/rpc-client";
import type { AppAPI, DefaultAPI } from "@storyflow/api";
import type { BucketAPI, CollabAPI } from "services-api";
import type {} from "@storyflow/rpc-client/types-shared";
import useSWR, { useSWRConfig } from "swr";
import { useUrlInfo } from "./users";
import { useContextWithError } from "./utils/contextError";
import { useAuth } from "./Auth";
import { ScopedMutator } from "swr/_internal";

const SWRCache = new Map();
export const provider = () => SWRCache;

const QueryContext = React.createContext<{
  url?: string;
  context?: Record<string, any>;
  headers?: Record<string, string>;
  generateHeaders?: () => Record<string, string>;
}>({});

export const useQueryContext = () => React.useContext(QueryContext);

export type Client = APIToClient<DefaultAPI>;
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

const createCache = (mutate: ScopedMutator<any>) => ({
  read: readFromCache,
  write(key: string, data: unknown) {
    if (SWRCache.get(key)) return;
    mutate(key, data);
  },
});

export function useAppClient() {
  const { mutate } = useSWRConfig();
  const { getToken } = useAuth();
  const { organization: slug, version } = useUrlInfo();
  const cache = React.useMemo(() => createCache(mutate), []);
  return createClient<AppAPI>(undefined, {
    context: { slug, version },
    generateHeaders: (): Record<string, string> => ({
      "x-storyflow-token": getToken() ?? "",
    }),
    cache,
  });
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
      generateHeaders: () => ({
        "x-storyflow-token": getToken() ?? "",
      }),
    }),
    [slug, apiUrl]
  );

  const cache = React.useMemo(() => createCache(mutate), []);

  const clientCtx = React.useMemo(
    () =>
      createClient<DefaultAPI>(queryCtx.url, {
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

export const SWRClient = createSWRClient<DefaultAPI & BucketAPI & CollabAPI>(
  undefined,
  {
    useSWR,
    useSWRConfig,
    useGlobalOptions: useQueryContext,
  }
);
