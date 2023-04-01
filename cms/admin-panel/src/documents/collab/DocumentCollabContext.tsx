import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { useClient } from "../../client";
import { createDocumentCollaboration } from "../../state/collaboration";
import { DocumentOp } from "shared/operations";

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
    return createDocumentCollaboration(client.fields.sync.mutation);
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

export function useDocumentMutate<T extends DocumentOp<any>>(
  document: string,
  key: string
) {
  const collab = useDocumentCollab();
  return React.useMemo(
    () => collab.mutate<T>(document, key),
    [collab, document, key]
  );
}
