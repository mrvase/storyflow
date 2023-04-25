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
import {
  INITIALIZATION_TAG,
  useEditorContext,
} from "../../../editor/react/EditorProvider";
import { getComputationDiff } from "./getComputationDiff";
import { tools } from "operations/editor-tools";
import { applyFieldOperation } from "operations/computation-tools";
import { FieldOperation, InferAction } from "operations/actions";
import { createQueueCache } from "../../../state/collaboration";
import { TokenStream } from "operations/types";
import { LibraryConfig } from "@storyflow/shared/types";
import {
  $createBlocksFromStream,
  $getComputation,
  $getIndexesFromSelection,
  $getPointFromIndex,
  $isSelection,
} from "../transforms";
import { createDiffOperations } from "./getBlocksDiff";

const RECONCILIATION_TAG = "reconciliation";

export function Reconciler({
  target,
  initialValue,
  push,
  register,
}: {
  initialValue: TokenStream;
  // history: CollabHistory<TextOp | FunctionOp>;
  target: string;
  push: (ops: FieldOperation[1]) => void;
  register: (listener: QueueListener<FieldOperation>) => () => void;
}) {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  React.useEffect(() => {
    const cache = createQueueCache({ stream: initialValue, transforms: [] });

    return register(({ trackedForEach, forEach }) => {
      // trackedForEach only adds any unique operation a single time.
      // Since we are using the bound register, it does not provide
      // the operations pushed from this specific field.

      const newOps: InferAction<FieldOperation>[] = [];
      trackedForEach(({ operation }) => {
        if (operation[0] === target) {
          newOps.push(...operation[1]);
        }
      });

      if (newOps.length === 0) return;

      const result = cache(forEach, (prev, { operation }) => {
        if (operation[0] === target) {
          prev.stream = applyFieldOperation(prev, operation).stream;
        }
        return prev;
      });

      editor.update(
        () => $reconcile(editor, result.stream, newOps, libraries),
        {
          tag: RECONCILIATION_TAG,
        }
      );
    });
  }, [editor, libraries]);

  React.useEffect(() => {
    return editor.registerUpdateListener(
      ({ editorState, prevEditorState, tags, dirtyElements }) => {
        if (tags.has(INITIALIZATION_TAG) || tags.has(RECONCILIATION_TAG)) {
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

function $reconcile(
  editor: LexicalEditor,
  value: TokenStream,
  actions: InferAction<FieldOperation>[],
  libraries: LibraryConfig[]
) {
  /** SAVE CURRENT SELECTION */
  try {
    const selection = $getSelection();
    let anchor: number | null = null;
    let focus: number | null = null;

    if ($isSelection(selection)) {
      [anchor, focus] = $getIndexesFromSelection(selection);
    }

    const root = $getRoot();

    const oldBlocks = root.getChildren();
    const newBlocks = $createBlocksFromStream(value, libraries);

    /** UPDATE CONTENT */
    const operations = createDiffOperations(oldBlocks, newBlocks, {
      compare: (a, b) => {
        if (a.type !== b.type) return false;
        return tools.equals($getComputation(a), $getComputation(b));
      },
    });

    operations.forEach(({ index, insert, remove }) => {
      root.splice(index, remove, insert);
    });

    /*
    $clearEditor();
    $initializeEditor(value, libraries);
    */

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
  } catch (err) {
    console.error(err);
  }
}
