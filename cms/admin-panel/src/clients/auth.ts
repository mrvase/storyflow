import { onInterval } from "../collab/interval";
import { authServicesMutate, authServicesQuery } from "./client-auth-services";
import type { ErrorCodes } from "@storyflow/api";
import { Fetcher, isError } from "@nanorpc/client";
import { AppReference } from "@storyflow/shared/types";
import {
  createGlobalState,
  useImmutableGlobalState,
} from "../state/useSubject";
import { useImmutableQuery } from "@nanorpc/client/swr";

export type Organization = {
  slug: string;
  apps: AppReference[];
  workspaces: { name: string }[];
};

export type AuthOptions = { token: string };

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()!.split(";").shift()!;
  }
};

export const useUser = () => {
  return useImmutableQuery(authServicesQuery.auth.authenticateUser());
};

const authHandler = () => {
  let token: string | null = null;

  const organizationState = createGlobalState<Organization | null>(null);
  const [, setOrganization] = organizationState;

  const urlState = createGlobalState<string | null>(null);
  const [, setUrl, registerUrlListener] = urlState;

  let slug = "";

  const updateOrganization = (newSlug: string) => {
    if (slug !== newSlug) {
      slug = newSlug;
      token = null;
      setUrl(null);
      setOrganization(null);
    }
    return updateToken(true);
  };

  const authenticateOrganization = (returnConfig: boolean = false) => {
    return authServicesMutate.auth.authenticateOrganization({
      organization: slug,
      returnConfig,
    });
  };

  const updateToken = async (initial: boolean = false) => {
    const result = await authenticateOrganization(initial);
    token = getCookie("sf.c.local-token") ?? token;

    if (initial) {
      if (isError(result)) {
        return result;
      }

      if (result.config) {
        setOrganization({
          slug,
          ...result.config,
        });
      }

      setUrl("url" in result && result.url ? `${result.url}/api` : null);
    }

    return result;
  };

  setTimeout(() => onInterval(() => updateToken(), { duration: 30000 }), 30000);

  const middleware = <TOptions extends AuthOptions>(
    fetcher: Fetcher<TOptions>
  ) => {
    return async (key: string, options: Omit<TOptions, keyof AuthOptions>) => {
      return await fetcher(key, {
        ...options,
        token,
      } as TOptions);
    };
  };

  return {
    middleware,
    updateOrganization,
    useOrganization: () => useImmutableGlobalState(organizationState),
    registerUrlListener,
  };
};

export const {
  middleware: authMiddleware,
  useOrganization,
  updateOrganization,
  registerUrlListener,
} = authHandler();
