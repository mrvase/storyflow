import React from "react";
import { ServerPackage } from "@storyflow/state";
import { useSingular } from "./useSingular";
import { queueForEach } from "@storyflow/state/collab";
import type { QueueListenerParam } from "@storyflow/state/collab";
import type { createCollaboration } from "./collaboration";
import { StdOperation } from "shared/operations";

export function createCollaborativeState<T, Operation extends StdOperation>(
  collab: ReturnType<typeof createCollaboration>,
  stateInitializer: (
    initialState: () => T
  ) => [state: T, setState: (value: T) => void],
  operator: (params: QueueListenerParam<Operation>) => T,
  {
    document,
    key,
    version,
    history,
  }: {
    document: string;
    key: string;
    version: number;
    history: ServerPackage<Operation>[];
  },
  hooks: {
    onStale?: () => void;
    onInitialization?: () => void;
  } = {}
) {
  /*
  const queue = React.useMemo(() => {
    return collab
      .getOrAddQueue<Operation>(document, key, {
        transform: (pkgs) => pkgs,
      })
      .initialize(version, history);
  }, [collab]);
  */

  const singular = useSingular(`collab/${document}/${key}`);

  let hasCalledStaleHook = React.useRef(false);

  React.useLayoutEffect(() => {
    collab
      .getOrAddQueue<Operation>(document, key, {
        transform: (pkgs) => pkgs,
      })
      .initialize(version, history);
    hasCalledStaleHook.current = false;
  }, [collab, version]);

  React.useLayoutEffect(() => {
    return collab.getQueue<Operation>(document, key)!.register((params) =>
      singular(() => {
        if (params.stale) {
          if (!hasCalledStaleHook.current) {
            hooks.onStale?.();
            hasCalledStaleHook.current = true;
          }
        }
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
  }, [collab, version, hooks.onStale, operator]);

  const [state, setState] = stateInitializer(() => {
    const forEach = (callback: any) => {
      queueForEach(history, callback, { clientId: "", index: 0, key: "" });
    };

    return operator({
      forEach,
      trackedForEach: forEach,
      origin: "initial",
      version,
      stale: false,
    });
  });

  return state;
}
