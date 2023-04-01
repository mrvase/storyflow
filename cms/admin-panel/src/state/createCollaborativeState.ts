import React from "react";
import { ServerPackage } from "@storyflow/state";
import { AnyOp } from "shared/operations";
import { useSingular } from "./useSingular";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";
import type { createDocumentCollaboration } from "./collaboration";

export function createCollaborativeState<T, Operation extends AnyOp>(
  collab: ReturnType<typeof createDocumentCollaboration>,
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
    onInvalidVersion?: () => void;
  } = {}
) {
  const queue = React.useMemo(() => {
    return collab
      .getOrAddQueue<Operation>(document, key, {
        transform: (pkgs) => pkgs,
      })
      .initialize(version, history);
  }, [collab]);

  const singular = useSingular(`collab/${document}/${key}`);

  React.useEffect(() => {
    return queue.register((params) =>
      singular(() => {
        if (version !== params.version) {
          console.warn("Invalid version", {
            instance: version,
            queue: params.version,
          });
          hooks.onInvalidVersion?.();
          return;
        }
        setState(operator(params));
      })
    );
  }, [queue, version, hooks.onInvalidVersion, operator]);

  const [state, setState] = stateInitializer(() => {
    let result: T | null = null;
    queue.run((params) => {
      result = operator(params);
    });
    return result!;
  });

  return state;
}
