import React from "react";
import { useContextWithError } from "../utils/contextError";

export const FolderDomainsContext = React.createContext<string[] | null>(null);
export const useFolderDomains = () =>
  useContextWithError(FolderDomainsContext, "FolderDomains");

export const FolderDomainsProvider = ({
  children,
  domains,
}: {
  children: React.ReactNode;
  domains: string[];
}) => {
  const parent = React.useContext(FolderDomainsContext);

  let next = new Set(parent ?? []);
  domains.forEach((d) => next.add(d));

  const array = React.useMemo(() => [...next], [parent, domains]);

  return (
    <FolderDomainsContext.Provider value={array}>
      {children}
    </FolderDomainsContext.Provider>
  );
};
