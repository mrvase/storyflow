import React from "react";
import cl from "clsx";
import { onInterval } from "./collab/interval";
import { isSuccess, unwrap } from "@storyflow/rpc-client/result";
import { createClient, createSWRClient } from "@storyflow/rpc-client";
import Loader from "./elements/Loader";
import useSWR, { useSWRConfig } from "swr";
import type { AuthAPI, CollabAPI, BucketAPI } from "services-api";
import { AppReference } from "@storyflow/api";
import { useLocation, useNavigate } from "@storyflow/router";
import { trimLeadingSlash } from "./utils/trimSlashes";

const url =
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`;

export const servicesClientWithoutContext = createClient<
  AuthAPI & BucketAPI & CollabAPI
>(url);

export const servicesClientSWR = createSWRClient<
  AuthAPI & BucketAPI & CollabAPI
>(url, {
  useSWR,
  useSWRConfig,
});

type Organization = {
  slug: string;
  apps: AppReference[];
  workspaces: { name: string }[];
};

const AuthContext = React.createContext<{
  user: {
    email: string;
  } | null;
  getToken: () => string | undefined;
  organization: Organization | null;
  apiUrl: string | null;
}>({
  user: null,
  organization: null,
  apiUrl: null,
  getToken: () => undefined,
});

export const useAuth = () => React.useContext(AuthContext);

function useToken() {
  const cachedToken = React.useRef<string | null>(null);

  const updateToken = React.useCallback(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()!.split(";").shift()!;
      }
    };
    cachedToken.current = getCookie("sf.c.local-token") ?? cachedToken.current;
  }, []);

  const getToken = React.useCallback(() => {
    return cachedToken.current ?? undefined;
  }, []);

  return [getToken, updateToken] as [typeof getToken, typeof updateToken];
}

function useOrganizationSlug(pathname: string) {
  const segments = trimLeadingSlash(pathname).split("/");
  const first = segments[0];
  return !first || first === "" || first.startsWith("~") ? null : first;
}

export function AuthProvider({
  children,
  organization: preset,
}: {
  organization?: { slug: string; url: string };
  children?: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const slug = preset ? preset.slug : useOrganizationSlug(pathname);

  const [getToken, updateToken] = useToken();

  const [isLoading, setIsLoading] = React.useState(true);

  const [apiUrl, setApiUrl] = React.useState<string | null>(null);

  const [user, setUser] = React.useState<{ email: string } | null>(null); // <-- confirms session in panel
  const [organization, setOrganization] = React.useState<Organization | null>(
    null
  ); // <-- confirms session in external api

  const reset = () => {
    setIsLoading(true);
    setUser(null);
    setOrganization(null);
    setApiUrl(null);
  };

  React.useEffect(() => {
    // authentication for panel
    if (slug === "logout") return;
    if (isLoading === false && slug === null) return;

    // sets global token, organization key, and returns user and organization url
    const run = async (returnConfig?: boolean) => {
      const result =
        await servicesClientWithoutContext.auth.authenticate.mutation({
          organization: {
            slug,
            url: preset?.url ?? null,
          },
          returnConfig: Boolean(returnConfig),
        });
      updateToken();
      return result;
    };

    run(true).then((result) => {
      const data = unwrap(result);
      if (!data) {
        if (pathname !== "/") {
          navigate(slug ? `/?next=${slug}` : "/");
        }
      } else {
        // we check previous state, because there is no need to trigger reference rerender
        // if user is already set
        setUser((ps) => (ps && ps.email === data.user.email ? ps : data.user));
        if (data.config) {
          setOrganization({
            slug: slug!, // we do not get a config, if there was no slug
            ...data.config!,
          });
        } else if (slug) {
          navigate(`/?unauthorized=${slug}`);
        }
      }

      setApiUrl(data?.url ? `${data.url}/api` : null);
      setIsLoading(false);
    });

    return onInterval(() => run(), { duration: 30000 });
  }, [slug, pathname]);

  const navigate = useNavigate();

  React.useEffect(() => {
    if (pathname === "/logout") {
      const logout = async () => {
        reset();
        await servicesClientWithoutContext.auth.logout.mutation();
        navigate("/", { replace: true });
      };
      logout();
    }
  }, [pathname]);

  const ctx = React.useMemo(
    () => ({
      user,
      organization,
      apiUrl,
      getToken,
    }),
    [user, organization]
  );

  if (isLoading) {
    return <div></div>;
  }

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
}

export function SignedIn({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  return user ? null : <>{children}</>;
}

export function SignIn() {
  const [show, setShow] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);

  const { search } = useLocation();

  React.useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);

    return () => {
      clearTimeout(t);
    };
  }, []);

  return isDone ? (
    <div className="w-full h-full flex-center">Email sendt</div>
  ) : (
    <div
      className={cl(
        "w-full h-full flex-center transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();

          const data = new FormData(ev.currentTarget);

          setIsLoading(true);

          const next = new URLSearchParams(search).get("next") ?? undefined;

          const result =
            await servicesClientWithoutContext.auth.sendEmail.mutation({
              email: data.get("email") as string,
              // get next url from query params
              ...(next && encodeURIComponent(next) === next && next.length < 50
                ? { next }
                : {}),
            });
          setIsLoading(false);
          if (isSuccess(result)) {
            setIsDone(true);
          }
        }}
        className="flex flex-col gap-5 items-center"
      >
        <input
          type="text"
          name="email"
          className="bg-gray-900 focus:bg-gray-850 px-5 py-2.5 rounded w-72 outline-none"
          placeholder="email"
          autoComplete="off"
        />
        <button className="ring-button flex-center w-32 h-10 rounded">
          {isLoading ? <Loader /> : "Log ind"}
        </button>
      </form>
    </div>
  );
}
