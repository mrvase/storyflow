import React from "react";
import { useSingular } from "../state/useSingular";
import type { QueueListenerParam } from "@storyflow/collab/queue";
import {
  QueueEntry,
  TimelineEntry,
  TransactionEntry,
} from "@storyflow/collab/types";
import { createQueueFromTimeline } from "@storyflow/collab/utils";
import { useCollab } from "./CollabContext";

export function initializeTimeline(
  timelineId: string,
  data: {
    timeline: TimelineEntry[];
    versions: Record<string, number> | number;
    initialData: any;
  },
  hooks: {
    onStale?: () => void;
    onInitialization?: () => void;
  } = {}
) {
  const collab = useCollab();

  let hasCalledStaleHook = React.useRef(false);

  React.useLayoutEffect(() => {
    collab.initializeTimeline(timelineId, data);
    hasCalledStaleHook.current = false;
  }, [collab, data.initialData, data.timeline, data.versions]);

  React.useEffect(() => {
    if (hooks.onStale) {
      return collab.getTimeline(timelineId)!.registerStaleListener(() => {
        if (!hasCalledStaleHook.current) {
          hooks.onStale?.();
          hasCalledStaleHook.current = true;
        }
      });
    }
  }, [hooks.onStale]);
}

export function useCollaborativeState<Data, TE extends TransactionEntry>(
  stateInitializer: (
    initialState: () => Data
  ) => [state: Data, setState: (value: Data) => void],
  operator: (
    params: QueueListenerParam<TE>,
    origin: "initial" | "update"
  ) => Data,
  {
    timelineId,
    queueId,
    version,
    timeline,
    target,
  }: {
    timelineId: string;
    queueId?: string;
    version: number;
    timeline: TimelineEntry[];
    target?: string;
  }
) {
  const collab = useCollab();

  const singular = useSingular(
    ["collab", timelineId, queueId, target ?? ""].filter(Boolean).join("-")
  );

  React.useLayoutEffect(() => {
    return collab
      .getTimeline(timelineId)!
      .getQueue<TE>(queueId)
      .register((params) =>
        singular(() => {
          if (version !== params.version) {
            console.warn("Invalid version", {
              instance: version,
              queue: params.version,
            });
            return;
          }
          setState(operator(params, "update"));
        })
      );
  }, [collab, version, operator]);

  const [state, setState] = stateInitializer(() => {
    return operator(
      {
        forEach(callback: (entry: QueueEntry<TE>) => void) {
          const queue = createQueueFromTimeline<TE>(timeline).filter(
            (entry) => entry.queue === (queueId ?? "")
          );
          queue.forEach((entry) => {
            callback(entry);
          });
        },
        version,
        stale: false,
      },
      "initial"
    );
  });

  return state;
}
