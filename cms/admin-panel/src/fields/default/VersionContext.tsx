import React from "react";
import { useContextWithError } from "../../utils/contextError";

const VersionContext = React.createContext<number | null>(null);

export function VersionProvider({
  children,
  version,
}: {
  children: React.ReactNode;
  version: number;
}) {
  return (
    <VersionContext.Provider value={version}>
      {children}
    </VersionContext.Provider>
  );
}

export const useFieldVersion = () =>
  useContextWithError(VersionContext, "VersionContext");
