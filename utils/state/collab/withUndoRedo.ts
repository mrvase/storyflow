import { Queue } from "./Queue";
import { DefaultOperation, WithMetaData } from "./types";

export type WithUndoRedo<Q extends Queue<any>> = Q & {
  undo: (state: any) => void;
  redo: (state: any) => void;
};

export type QueueInvertStrategy<Operation extends DefaultOperation> = (
  state: any,
  action: Operation,
  interceptions: WithMetaData<Operation>[],
  context: { clientId: string }
) => Operation | null;

export function withUndoRedo<Operation extends { mode?: string }>(
  queue: Queue<Operation>,
  strategy?: QueueInvertStrategy<Operation>
): WithUndoRedo<Queue<Operation>> {
  function alterHistory() {}

  function undo() {}

  function redo() {}

  return Object.assign(queue, { alterHistory, undo, redo });
}
