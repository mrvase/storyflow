import React from "react";
import { useContextWithError } from "../utils/contextError";
import { createCollaboration } from "./collaboration";
import { Queue } from "@storyflow/collab/Queue";
import { TransactionEntry } from "@storyflow/collab/types";
import { DocumentId } from "@storyflow/shared/types";
import { servicesMutate } from "../clients/client-services";

export const DocumentCollabContext = React.createContext<ReturnType<
  typeof createCollaboration
> | null>(null);

export const useCollab = () =>
  useContextWithError(DocumentCollabContext, "Collab");

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const collab = React.useMemo(() => {
    return createCollaboration({
      sync: servicesMutate.collab.sync,
      update: servicesMutate.collab.update,
    });
  }, []);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, []);

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
