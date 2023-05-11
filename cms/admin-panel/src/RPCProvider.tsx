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
import { useContextWithError } from "./utils/contextError";
import { useAuth } from "./Auth";
import { ScopedMutator } from "swr/_internal";

const servicesUrl = "http://localhost:3000/api";

/* cache */

const SWRCache = new Map();
export const provider = () => SWRCache;

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

export type Client = APIToClient<DefaultAPI>;
export type ServicesClient = APIToClient<BucketAPI & CollabAPI>;

const ClientContext = React.createContext<Client | null>(null);
export const useClient = () => useContextWithError(ClientContext, "Client");

const ServicesClientContext = React.createContext<ServicesClient | null>(null);
export const useServicesClient = () =>
  useContextWithError(ServicesClientContext, "ServicesClient");

export function useAppClient() {
  const { mutate } = useSWRConfig();
  const { getToken, organization } = useAuth();
  const cache = React.useMemo(() => createCache(mutate), []);
  return createClient<AppAPI>(undefined, {
    context: { slug: organization?.slug },
    generateHeaders: (): Record<string, string> => ({
      "x-storyflow-token": getToken() ?? "",
    }),
    cache,
  });
}

export function RPCProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  const { getToken, apiUrl, organization } = useAuth();

  const queryCtx = React.useMemo(
    () => ({
      url: apiUrl!, // is certainly known here because it is set when signed in
      context: { slug: organization?.slug ?? "" },
      generateHeaders: () => ({
        "x-storyflow-token": getToken() ?? "",
      }),
    }),
    [organization, apiUrl]
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
    <GlobalOptionsContext.Provider value={queryCtx}>
      <ClientContext.Provider value={clientCtx}>
        <ServicesClientContext.Provider value={servicesClientCtx}>
          {organization ? children : null}
        </ServicesClientContext.Provider>
      </ClientContext.Provider>
    </GlobalOptionsContext.Provider>
  );
}

const GlobalOptionsContext = React.createContext<{
  url?: string;
  context?: Record<string, any>;
  headers?: Record<string, string>;
  generateHeaders?: () => Record<string, string>;
}>({});

const useGlobalOptions = () => React.useContext(GlobalOptionsContext);

export const SWRClient = createSWRClient<DefaultAPI & BucketAPI & CollabAPI>(
  undefined,
  {
    useSWR,
    useSWRConfig,
    useGlobalOptions,
  }
);
