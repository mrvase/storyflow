import React from "react";
import { onInterval } from "./collab/interval";
import { unwrap } from "@storyflow/result";
import { createClient, createSWRClient } from "@sfrpc/client";
import Loader from "./elements/Loader";
import useSWR, { useSWRConfig } from "swr";
import type { AuthAPI } from "services-api/auth";
import type { CollabAPI } from "services-api/collab";
import type { BucketAPI } from "services-api/bucket";
import { useUrlInfo } from "./users";

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

const AuthContext = React.createContext<{
  user: {
    email: string;
  } | null;
  getToken: () => string;
}>({ user: null, getToken: () => "" });

export const useAuth = () => React.useContext(AuthContext);

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const { organization } = useUrlInfo();

  const [user, setUser] = React.useState<{ email: string } | null>(null);

  React.useEffect(() => {
    const func = async () => {
      const result = await servicesClient.auth.update.mutation(organization);
      setUser((ps) => (ps ? ps : unwrap(result, null)));
    };

    func();
    return onInterval(func, { duration: 30000 });
  }, []);

  const ctx = React.useMemo(
    () => ({
      user,
      getToken: () => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; sf.token=`);
        if (parts.length === 2) {
          return parts.pop()!.split(";").shift()!;
        }
        return "";
      },
    }),
    [user]
  );

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

  React.useEffect(() => {
    const t = setTimeout(() => setShow(true), 500);

    return () => {
      clearTimeout(t);
    };
  }, []);

  return show ? (
    <div className="w-full h-full flex-center">
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();

          const data = new FormData(ev.currentTarget);

          setIsLoading(true);
          await servicesClient.auth.sendEmail.query(
            data.get("email") as string
          );
          setIsLoading(false);
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
  ) : null;
}
