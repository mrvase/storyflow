import { onInterval } from "../collab/interval";
import { authServicesMutate } from "./client-auth-services";
import { Fetcher, isError } from "@nanorpc/client";
import { AppReference } from "@storyflow/shared/types";
import {
  createGlobalState,
  useImmutableGlobalState,
} from "../state/useSubject";

type Organization = {
  slug: string;
  apps: AppReference[];
  workspaces: { name: string }[];
};

export type AuthOptions = { url: string; token: string };

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()!.split(";").shift()!;
  }
};

const authHandler = () => {
  // global user
  const userState = createGlobalState<{ email: string } | null>(null);
  const [, setUser] = userState;

  let token: string | null = null;

  const organizationState = createGlobalState<Organization | null>(null);
  const [, setOrganization] = organizationState;

  let url: string | null = null;

  let promise: ReturnType<typeof updateToken> | null = null;

  let slug = "";

  const setOrganizationSlug = (newSlug: string) => {
    if (slug !== newSlug) {
      slug = newSlug;
      token = null;
      url = null;
      setOrganization(null);
    }
  };

  const call = (returnConfig: boolean = false) => {
    return authServicesMutate.auth.authenticate({
      organization: {
        slug,
        url: null, // preset?.url ?? null
      },
      returnConfig,
    });
  };

  const updateToken = async (initial: boolean = false) => {
    const result = await call(initial);
    token = getCookie("sf.c.local-token") ?? token;

    if (initial) {
      if (isError(result)) {
        // window.location.assign(slug ? `/?next=${slug}` : "/");
        throw new Error(result.error);
      }

      setUser(result.user);

      if (result.config) {
        setOrganization({
          slug: slug!, // we do not get a config, if there was no slug
          ...result.config!,
        });
      } else if (slug) {
        // window.location.assign(`/?unauthorized=${slug}`);
      }

      url = "url" in result ? `${result.url}/api` : null;
    }

    return result;
  };

  const getAuthData = async () => {
    if (url && token) {
      return { url, token };
    }

    if (!promise) {
      console.log("INITIAL");
      promise = updateToken(true).then((res) => {
        promise = null;
        return res;
      });
    }

    await promise;

    return { url, token };
  };

  setTimeout(() => onInterval(() => updateToken(), { duration: 30000 }), 30000);

  const middleware = <TOptions extends AuthOptions>(
    fetcher: Fetcher<TOptions>
  ) => {
    return async (key: string, options: Omit<TOptions, keyof AuthOptions>) => {
      // get the needed things...
      const { url, token } = await getAuthData();

      return await fetcher(key, {
        ...options,
        url,
        token,
      } as TOptions);
    };
  };

  return {
    middleware,
    setOrganizationSlug,
    checkToken: async () => {
      const result = await call();
      if (!isError(result)) {
        setUser(result.user);
      }
    },
    useUser: () => useImmutableGlobalState(userState),
    useOrganization: () => useImmutableGlobalState(organizationState),
  };
};

export const {
  middleware: authMiddleware,
  useUser,
  checkToken,
  useOrganization,
  setOrganizationSlug,
} = authHandler();
