import cl from "clsx";
import React from "react";
import Loader from "./elements/Loader";
import { Link } from "@nanokit/router";
import { useUser } from "./clients/auth";
import { authServicesMutate } from "./clients/client-auth-services";

export function Organizations() {
  const { data, error } = useUser();

  if (error) {
    return <>failed</>;
  }

  if (!data) {
    return <>loading</>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full flex-center p-5 grow">
        <div className="grid grid-cols-3 w-full max-w-4xl gap-5">
          <AddOrganization index={0} />
          {data.organizations.map((data, index) => (
            <Organization index={index + 1} key={data.slug} data={data} />
          ))}
        </div>
      </div>
      <div className="w-full py-5 flex flex-col gap-3 items-center text-sm">
        <div className="text-gray-600">Logget ind som {data.email}</div>
        <Link to="/logout" className="rounded px-4 py-2 ring-button">
          Log ud
        </Link>
      </div>
    </div>
  );
}

export function OrganizationCard({
  index,
  children,
  className,
  ...action
}: {
  index: number;
  children: React.ReactNode;
  className?: string;
  to?: string;
}) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  const Component = action.to ? Link : "div";

  return (
    <Component
      {...(action as any)}
      className={cl(
        "rounded bg-white dark:bg-gray-900 p-5 h-52 transition-[transform,opacity] duration-300 ease-out",
        isMounted ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className
      )}
      style={{
        transitionDelay: `${index * 50}ms`,
      }}
    >
      {children}
    </Component>
  );
}

export function Organization({
  index,
  data,
}: {
  index: number;
  data: { slug: string; url: string };
}) {
  return (
    <OrganizationCard
      index={index}
      to={`/${data.slug}/~`}
      className={cl("flex flex-col justify-center gap-3")}
    >
      <div className="text-3xl">{data.slug}</div>
      <div className="text-gray-400">{data.url}</div>
    </OrganizationCard>
  );
}

export function AddOrganization({ index }: { index: number }) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <OrganizationCard index={index}>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          setIsLoading(true);
          await authServicesMutate.auth.addOrganization({
            slug: data.get("slug") as string,
            url: (data.get("url") as string) || undefined,
          });
          setIsLoading(false);
        }}
        className="h-full w-full flex flex-col justify-center gap-3"
      >
        <input
          type="text"
          name="slug"
          className={cl(
            "bg-gray-850 focus:bg-gray-800 px-5 py-2.5 rounded w-full outline-none"
          )}
          placeholder="Navn"
          autoComplete="off"
        />
        <input
          type="text"
          name="url"
          className={cl(
            "bg-gray-850 focus:bg-gray-800 px-5 py-2.5 rounded w-full outline-none",
            isCreating ? "block" : "hidden"
          )}
          placeholder="URL"
          autoComplete="off"
        />
        <div className="flex justify-end gap-3 text-sm">
          {isCreating ? (
            <>
              <button
                type="button"
                className="px-4 py-2 rounded"
                onClick={() => setIsCreating(false)}
              >
                Tilbage
              </button>
              <button type="submit" className="ring-button px-4 py-2 rounded">
                {isLoading ? <Loader /> : "Bekræft"}
              </button>
            </>
          ) : (
            <>
              <button
                className="px-4 py-2 rounded"
                type="button"
                onClick={() => setIsCreating(true)}
              >
                Opret
              </button>
              <button type="submit" className="ring-button px-4 py-2 rounded">
                {isLoading ? <Loader /> : "Tilføj"}
              </button>
            </>
          )}
        </div>
      </form>
    </OrganizationCard>
  );
}
