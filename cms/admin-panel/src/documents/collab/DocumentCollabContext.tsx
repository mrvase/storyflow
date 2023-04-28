import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { useClient } from "../../client";
import { createCollaboration } from "../../state/collab_new";
import { Queue } from "@storyflow/collab/Queue";
import { TransactionEntry } from "@storyflow/collab/types";

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
    return createCollaboration(client.collab.fields.mutation);
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

export function useDocumentPush<TE extends TransactionEntry>(
  document: string,
  key: string
) {
  const collab = useDocumentCollab();
  return React.useCallback(
    (...args: Parameters<Queue<TE>["push"]>) =>
      collab
        .getTimeline(document)!
        .getQueue<TE>(key)
        .push(...args),
    [collab, document, key]
  );
}

/*
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
*/
