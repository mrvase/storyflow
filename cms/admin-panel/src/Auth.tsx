import React from "react";
import cl from "clsx";
import { onInterval } from "./collab/interval";
import { Result, error, isError, unwrap } from "@storyflow/rpc-client/result";
import { createClient, createSWRClient } from "@storyflow/rpc-client";
import Loader from "./elements/Loader";
import useSWR, { useSWRConfig } from "swr";
import type { AuthAPI, CollabAPI, BucketAPI } from "services-api";
import { useUrlInfo } from "./users";
import { AppReference } from "@storyflow/api";
import { useLocation, useNavigate } from "@storyflow/router";

const url =
  process.env.NODE_ENV === "production" ? `/api` : `http://localhost:3000/api`;

export const servicesClient = createClient<AuthAPI & BucketAPI & CollabAPI>(
  url
);
export const servicesClientSWR = createSWRClient<
  AuthAPI & BucketAPI & CollabAPI
>(url, {
  useSWR,
  useSWRConfig,
});

type Organization = { apps: AppReference[]; workspaces: { name: string }[] };

const AuthContext = React.createContext<{
  user: {
    email: string;
  } | null;
  getToken: () => string | undefined;
  organization: Organization | null;
  apiUrl: string | null;
}>({ user: null, organization: null, apiUrl: null, getToken: () => undefined });

export const useAuth = () => React.useContext(AuthContext);

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()!.split(";").shift()!;
  }
};

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const { organization: slug } = useUrlInfo();

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
    (async () => {
      // sets global token, organization key, and returns user and organization url
      const result = unwrap(
        await servicesClient.auth.authenticate.mutation(slug)
      );

      // we check previous state, because there is no need to trigger reference rerender
      // if user is already set
      if (!result) {
        navigate("/");
      }

      setUser((ps) => (!ps && result ? result.user : ps));
      setApiUrl(result?.url ? `${result.url}/api` : null);
      setIsLoading(false);
    })();
  }, [slug]);

  const navigate = useNavigate();

  React.useEffect(() => {
    // authentication for organization api
    if (!apiUrl) return;

    const run = async (includeHeader?: boolean) => {
      const token = getCookie("sf.c.token");
      if (!token && includeHeader) return error({ message: "No token" });
      return await fetch(`${apiUrl}/admin/authenticate`, {
        method: "POST",
        credentials: "include",
        headers:
          includeHeader && token
            ? {
                "x-storyflow-token": token,
              }
            : undefined,
      }).then(async (res) => {
        const json = (await res.json()) as Promise<Result<Organization>>;
        return json;
      });
    };

    run(true).then((result) => {
      if (isError(result)) {
        navigate("/");
      } else {
        setOrganization(unwrap(result));
      }
    });

    return onInterval(() => run(), { duration: 30000 });
    // navigate depends on pathname, but is not relevant for this effect
  }, [apiUrl]);

  const { pathname } = useLocation();

  React.useEffect(() => {
    if (pathname === "/logout") {
      const logout = async () => {
        reset();
        await servicesClient.auth.logout.mutation();
        navigate("/", { replace: true });
      };
      logout();
    }
  }, [servicesClient, pathname]);

  const ctx = React.useMemo(
    () => ({
      user,
      organization,
      apiUrl,
      getToken: () => getCookie("sf.c.local-token"),
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
          await servicesClient.auth.sendEmail.query(
            data.get("email") as string
          );
          setIsLoading(false);
          setIsDone(true);
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
