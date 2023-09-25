import React from "react";
import { useSingular } from "../state/useSingular";
import { QueueEntry, TransactionEntry } from "@storyflow/collab/types";
import { collab } from "./CollabContext";
import { DocumentId } from "@storyflow/shared/types";
import { Queue } from "@storyflow/collab/Queue";

export function useCollaborativeState<Data, TE extends TransactionEntry>(
  stateInitializer: (
    initialState: () => Data
  ) => [state: Data, setState: (value: Data) => void],
  operator: (
    forEach: Queue<TE>["forEach"] | undefined,
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
  const singularId = ["collab", timelineId, queueId, target ?? ""]
    .filter(Boolean)
    .join("-");

  const singular = useSingular(singularId);

  const getQueue = () => collab.getTimeline(timelineId)?.getQueue<TE>(queueId);

  React.useEffect(() => {
    const queue = getQueue()!;
    return queue.register(() =>
      singular(() => setState(operator(queue.forEach, "update")))
    );
  }, [collab, operator]);

  const [state, setState] = stateInitializer(() => {
    return operator(getQueue()?.forEach, "initial");
  });

  return state;
}
