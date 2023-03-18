import React from "react";
import { ServerPackage } from "@storyflow/state";
import { AnyOp } from "shared/operations";
import { useSingular } from "../../state/useSingular";
import { QueueListenerParam } from "@storyflow/state/collab/Queue";
import { useFolderCollab } from "./FolderCollabContext";

/*
export function createCollaborativeState<T, Operation extends AnyOp>(
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
  }
) {
  const collab = useFolderCollab();

  const invalidVersion = React.useCallback(
    (currentVersion: number | null) => {
      return version !== currentVersion;
    },
    [version]
  );

  const queue = React.useMemo(() => {
    return collab
      .getOrAddQueue<Operation>(document, key, {
        transform: (pkgs) => pkgs,
      })
      .initialize(version, history);
  }, []);

  const singular = useSingular(`collab/${document}/${key}`);

  React.useEffect(() => {
    return queue.register((params) =>
      singular(() => {
        if (invalidVersion(params.version)) return;
        setState(operator(params));
      })
    );
  }, []);

  const [state, setState] = stateInitializer(() => {
    let result: T | null = null;
    queue.run((params) => {
      result = operator(params);
    });
    return result!;
  });

  return state;
}
*/
