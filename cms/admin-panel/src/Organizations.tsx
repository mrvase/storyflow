import cl from "clsx";
import React from "react";
import { servicesClient, servicesClientSWR } from "./Auth";
import Loader from "./elements/Loader";

export function Organizations() {
  const { data } = servicesClientSWR.auth.getOrganizations.useQuery(undefined, {
    immutable: true,
  });

  return (
    <div className="w-full h-full flex-center p-5">
      <div className="grid grid-cols-3 w-full max-w-4xl gap-5">
        {(data?.organizations ?? []).map((data) => (
          <Organization key={data.slug} data={data} />
        ))}
        <AddOrganization />
      </div>
      <button
        onClick={async () => {
          await servicesClient.auth.logout.mutation();
        }}
      >
        Log ud
      </button>
    </div>
  );
}

export function OrganizationCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cl("rounded bg-gray-900 p-5 h-52", className)}>
      {children}
    </div>
  );
}

export function Organization({
  data,
}: {
  data: { slug: string; url: string };
}) {
  return (
    <OrganizationCard className="flex flex-col justify-center gap-3">
      <div className="text-3xl">{data.slug}</div>
      <div className="text-gray-400">{data.url}</div>
    </OrganizationCard>
  );
}

export function AddOrganization() {
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <OrganizationCard>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          setIsLoading(true);
          await servicesClient.auth.addOrganization.mutation({
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
