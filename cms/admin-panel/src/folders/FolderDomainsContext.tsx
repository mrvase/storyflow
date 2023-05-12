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
  domains: string[] | undefined;
}) => {
  const parent = React.useContext(FolderDomainsContext);

  const array = React.useMemo(() => {
    let next = new Set(parent ?? []);
    (domains ?? []).forEach((d) => next.add(d));
    return Array.from(next);
  }, [parent, domains]);

  return (
    <FolderDomainsContext.Provider value={array}>
      {children}
    </FolderDomainsContext.Provider>
  );
};
