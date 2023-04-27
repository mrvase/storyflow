import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { useClient } from "../../client";
import { createCollaboration } from "../../state/collaboration";
import { StdOperation } from "operations/actions";

export const DocumentCollabContext = React.createContext<ReturnType<
  typeof createCollaboration
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
    return createCollaboration(client.fields.sync.mutation);
  }, [client]);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, [client]);

  return (
    <DocumentCollabContext.Provider value={collab}>
      {children}
    </DocumentCollabContext.Provider>
  );
}

export function useDocumentMutate<T extends StdOperation<any>>(
  document: string,
  key: string
) {
  const collab = useDocumentCollab();
  return React.useMemo(
    () => collab.mutate<T>(document, key),
    [collab, document, key]
  );
}
