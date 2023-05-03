import React from "react";
import { useContextWithError } from "../utils/contextError";
import { useClient } from "../client";
import { createCollaboration } from "./collaboration";
import { Queue } from "@storyflow/collab/Queue";
import { TransactionEntry } from "@storyflow/collab/types";
import { DocumentId } from "@storyflow/shared/types";

export const DocumentCollabContext = React.createContext<ReturnType<
  typeof createCollaboration
> | null>(null);

export const useCollab = () =>
  useContextWithError(DocumentCollabContext, "Collab");

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const client = useClient();

  const collab = React.useMemo(() => {
    return createCollaboration({
      sync: client.collab.sync.mutation,
      update: client.collab.update.mutation,
    });
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
  timelineId: DocumentId | "folders" | "documents",
  queueId?: string
) {
  const collab = useCollab();
  return React.useCallback(
    (...args: Parameters<Queue<TE>["push"]>) =>
      collab
        .getTimeline(timelineId)!
        .getQueue<TE>(queueId)
        .push(...args),
    [collab, timelineId, queueId]
  );
}
