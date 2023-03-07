import React from "react";
import { useContextWithError } from "../utils/contextError";
import { useClient } from "../client";
import { createDocumentCollaboration } from "./collaboration";

export const DocumentCollabContext = React.createContext<ReturnType<
  typeof createDocumentCollaboration
> | null>(null);

export const useDocumentCollab = () =>
  useContextWithError(DocumentCollabContext, "Collab");

export function DocumentCollabProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useClient();

  const collab = React.useMemo(() => {
    return createDocumentCollaboration(client.articles.sync.mutation);
  }, [client]);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, []);

  return (
    <DocumentCollabContext.Provider value={collab}>
      {children}
    </DocumentCollabContext.Provider>
  );
}
