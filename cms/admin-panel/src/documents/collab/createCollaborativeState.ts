import React from "react";
import { useSingular } from "../../state/useSingular";
import type { QueueListenerParam } from "@storyflow/collab/queue";
import type { createCollaboration } from "../../state/collab_new";
import {
  QueueEntry,
  TimelineEntry,
  TransactionEntry,
} from "@storyflow/collab/types";
import { createQueueFromTimeline } from "@storyflow/collab/utils";

export function initializeTimeline(
  collab: ReturnType<typeof createCollaboration>,
  {
    id,
    timeline,
    versions,
    transform,
  }: {
    id: string;
    timeline: TimelineEntry[];
    versions: Record<string, number>;
    transform?: (pkgs: TimelineEntry[]) => TimelineEntry[];
  },
  hooks: {
    onStale?: () => void;
    onInitialization?: () => void;
  } = {}
) {
  let hasCalledStaleHook = React.useRef(false);

  React.useLayoutEffect(() => {
    collab
      .getOrAddTimeline(id, {
        transform,
      })
      .initialize(timeline, versions);
    hasCalledStaleHook.current = false;
  }, [collab, timeline, versions]);

  React.useEffect(() => {
    if (hooks.onStale) {
      return collab.getTimeline(id)!.registerStaleListener(() => {
        if (!hasCalledStaleHook.current) {
          hooks.onStale?.();
          hasCalledStaleHook.current = true;
        }
      });
    }
  }, [hooks.onStale]);
}

export function createCollaborativeState<Data, TE extends TransactionEntry>(
  collab: ReturnType<typeof createCollaboration>,
  stateInitializer: (
    initialState: () => Data
  ) => [state: Data, setState: (value: Data) => void],
  operator: (params: QueueListenerParam<TE>) => Data,
  {
    document,
    key,
    version,
    timeline,
  }: {
    document: string;
    key: string;
    version: number;
    timeline: TimelineEntry[];
  }
) {
  const singular = useSingular(`collab/${document}/${key}`);

  React.useLayoutEffect(() => {
    return collab
      .getTimeline(document)!
      .getQueue<TE>(key)
      .register((params) =>
        singular(() => {
          if (version !== params.version) {
            console.warn("Invalid version", {
              instance: version,
              queue: params.version,
            });
            return;
          }
          setState(operator(params));
        })
      );
  }, [collab, version, operator]);

  const [state, setState] = stateInitializer(() => {
    return operator({
      forEach(callback: (entry: QueueEntry<TE>) => void) {
        const queue = createQueueFromTimeline<TE>(timeline, []).filter(
          (entry) => entry.queue === key
        );
        queue.forEach((entry) => {
          callback(entry);
        });
      },
      version,
      stale: false,
    });
  });

  return state;
}
