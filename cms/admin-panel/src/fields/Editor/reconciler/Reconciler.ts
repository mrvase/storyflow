import { QueueListener } from "@storyflow/state";
import {
  $getRoot,
  $getSelection,
  $isTextNode,
  $setSelection,
  LexicalEditor,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../../client-config";
import $createRangeSelection from "../../../editor/createRangeSelection";
import { useEditorContext } from "../../../editor/react/EditorProvider";
import { getComputationDiff } from "./getComputationDiff";
import { tools } from "shared/editor-tools";
import { getNextState } from "shared/computation-tools";
import { InferAction, Target, ComputationOp } from "shared/operations";
import { createQueueCache } from "../../../state/collaboration";
import { TokenStream } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import {
  $clearEditor,
  $createBlocksFromStream,
  $getComputation,
  $getIndexesFromSelection,
  $getPointFromIndex,
  $initializeEditor,
  $isSelection,
  $isTextBlockNode,
} from "../transforms";
import { createDiffOperations } from "./getBlocksDiff";

export function Reconciler({
  target,
  initialValue,
  push,
  register,
}: {
  initialValue: TokenStream;
  // history: CollabHistory<TextOp | FunctionOp>;
  target: Target;
  push: (ops: ComputationOp["ops"]) => void;
  register: (listener: QueueListener<ComputationOp>) => () => void;
}) {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  React.useEffect(() => {
    const cache = createQueueCache(initialValue);

    return register(({ trackedForEach, forEach }) => {
      const newOps: InferAction<ComputationOp>[] = [];
      // This forEach only adds any unique operation a single time.
      // Since we are using the bound register, it does not provide
      // the operations pushed from this specific field.
      trackedForEach(({ operation }) => {
        if (operation.target === target) {
          newOps.push(...operation.ops);
        }
      });
      const result = cache(forEach, (prev, { operation }) => {
        if (operation.target === target) {
          prev = getNextState(prev, operation);
        }
        return prev;
      });
      if (newOps.length > 0) {
        reconcile(editor, result, newOps, libraries);
      }
    });
  }, [editor, libraries]);

  React.useEffect(() => {
    return editor.registerUpdateListener(
      ({ editorState, prevEditorState, tags, dirtyElements }) => {
        if (tags.has("cms") || tags.has("reconciliation")) {
          return;
        }

        if (dirtyElements.size === 0) {
          return;
        }

        const prev = prevEditorState.read(() => $getComputation($getRoot()));
        const next = editorState.read(() => $getComputation($getRoot()));

        const action = getComputationDiff(prev, next);

        console.log("DIFF", action);

        if (!action) {
          return;
        }

        push(action.map((el) => ({ ...el })));
      }
    );
  }, [editor, push]);

  return null;
}

function reconcile(
  editor: LexicalEditor,
  value: TokenStream,
  actions: InferAction<ComputationOp>[],
  libraries: LibraryConfig[]
) {
  editor.update(
    () => {
      /** SAVE CURRENT SELECTION */
      const selection = $getSelection();
      let anchor: number | null = null;
      let focus: number | null = null;

      if ($isSelection(selection)) {
        [anchor, focus] = $getIndexesFromSelection(selection);
      }

      const root = $getRoot();

      const oldBlocks = root.getChildren();
      const newBlocks = $createBlocksFromStream(value, libraries);

      const operations = createDiffOperations(oldBlocks, newBlocks, {
        compare: (a, b) => {
          if (a.type !== b.type) return false;
          return tools.equals($getComputation(a), $getComputation(b));
        },
      });

      console.log("** OPERATIONS", operations[0].index);

      /** UPDATE CONTENT */
      // $clearEditor();
      // $initializeEditor(value, libraries);

      operations.forEach(({ index, insert, remove }) => {
        root.splice(index, remove, insert);
      });

      /** UPDATE SELECTION */
      if (
        anchor !== null &&
        focus !== null &&
        document.activeElement === editor.getRootElement()
      ) {
        anchor = actions.reduce((acc: number, cur) => {
          if ("name" in cur) return acc;
          if (cur.index > acc) return acc;
          return acc + tools.getLength(cur.insert ?? []) - (cur.remove ?? 0);
        }, anchor);

        focus = anchor;

        let [anchorNode, anchorOffset] = $getPointFromIndex("cursor", anchor);
        let [focusNode, focusOffset] = $getPointFromIndex("cursor", focus);

        if ($isTextNode(anchorNode) && $isTextNode(focusNode)) {
          const newSelection = $createRangeSelection(
            { node: anchorNode, offset: anchorOffset },
            {
              node: focusNode,
              offset: focusOffset,
            }
          );
          $setSelection(newSelection);
          return;
        }
      }

      $setSelection(null);
    },
    {
      tag: "reconciliation",
    }
  );
}
