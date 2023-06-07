import React from "react";
import cl from "clsx";
import Loader from "./elements/Loader";
import { useUser } from "./clients/auth";
import { authServicesMutate } from "./clients/client-auth-services";
import { isError } from "@nanorpc/client";
import { useLocation } from "@nanokit/router";

export function SignedIn({ children }: { children?: React.ReactNode }) {
  const user = useUser();
  return user.data && !user.error ? <>{children}</> : null;
}

export function SignedOut({ children }: { children?: React.ReactNode }) {
  const user = useUser();
  return user.data && !user.error ? null : <>{children}</>;
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

          const result = await authServicesMutate.auth.sendEmail({
            email: data.get("email") as string,
            // get next url from query params
            ...(next && encodeURIComponent(next) === next && next.length < 50
              ? { next }
              : {}),
          });
          setIsLoading(false);
          if (!isError(result)) {
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
