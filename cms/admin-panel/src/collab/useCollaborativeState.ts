import React from "react";
import { useSingular } from "../state/useSingular";
import { QueueEntry, TransactionEntry } from "@storyflow/collab/types";
import { useCollab } from "./CollabContext";
import { DocumentId } from "@storyflow/shared/types";
import { Queue } from "@storyflow/collab/Queue";

export function useCollaborativeState<Data, TE extends TransactionEntry>(
  stateInitializer: (
    initialState: () => Data
  ) => [state: Data, setState: (value: Data) => void],
  operator: (
    forEach: Queue<TE>["forEach"],
    origin: "initial" | "update"
  ) => Data,
  {
    timelineId,
    queueId,
    target,
  }: {
    timelineId: DocumentId | "folders" | "documents";
    queueId?: string;
    target?: string;
  }
) {
  const collab = useCollab();

  const singular = useSingular(
    ["collab", timelineId, queueId, target ?? ""].filter(Boolean).join("-")
  );

  React.useEffect(() => {
    const queue = collab.getTimeline(timelineId)!.getQueue<TE>(queueId);
    return queue.register(() =>
      singular(() => {
        setState(operator(queue.forEach, "update"));
      })
    );
  }, [collab, operator]);

  const [state, setState] = stateInitializer(() => {
    return operator((callback: (entry: QueueEntry<TE>) => void) => {
      const queue = collab.getTimeline(timelineId)?.getQueue<TE>(queueId);
      console.log("HAS QUEUE READY", queue);
      if (queue) {
        queue.forEach((entry) => {
          callback(entry);
        });
      }
    }, "initial");
  });

  return state;
}
