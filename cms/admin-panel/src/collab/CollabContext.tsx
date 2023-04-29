import React from "react";
import { useContextWithError } from "../utils/contextError";
import { useClient } from "../client";
import { createCollaboration } from "./collaboration";
import { Queue } from "@storyflow/collab/Queue";
import { TransactionEntry } from "@storyflow/collab/types";

export const DocumentCollabContext = React.createContext<ReturnType<
  typeof createCollaboration
> | null>(null);

export const useCollab = () =>
  useContextWithError(DocumentCollabContext, "Collab");

export function CollabProvider({ children }: { children: React.ReactNode }) {
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

export function usePush<TE extends TransactionEntry>(
  document: string,
  key: string
) {
  const collab = useCollab();
  return React.useCallback(
    (...args: Parameters<Queue<TE>["push"]>) =>
      collab
        .getTimeline(document)!
        .getQueue<TE>(key)
        .push(...args),
    [collab, document, key]
  );
}
