import { $getRoot, $getSelection, $setSelection, LexicalEditor } from "lexical";
import React from "react";
import { useClientConfig } from "../../../client-config";
import {
  INITIALIZATION_TAG,
  useEditorContext,
} from "../../../editor/react/EditorProvider";
import { getComputationDiff } from "./getComputationDiff";
import { tools } from "operations/stream-methods";
import { applyFieldTransaction } from "operations/apply";
import { createQueueCache } from "../../../collab/createQueueCache";
import type { TokenStream } from "operations/types";
import type { DocumentId, LibraryConfig } from "@storyflow/shared/types";
import {
  $createBlocksFromStream,
  $getComputation,
  $getIndexesFromSelection,
  $isSelection,
} from "../transforms";
import { createDiffOperations } from "./getBlocksDiff";
import {
  FieldTransactionEntry,
  StreamOperation,
  TransformOperation,
} from "operations/actions";
import { useCollab } from "../../../collab/CollabContext";
import { useFieldId } from "../../FieldIdContext";
import { getDocumentId, getRawFieldId } from "@storyflow/fields-core/ids";
import { isSpliceOperation } from "@storyflow/collab/utils";
import { usePanel } from "../../../layout/panel-router/Routes";

const RECONCILIATION_TAG = "reconciliation";

export function Reconciler({
  target,
  initialValue,
  push,
  tracker,
}: {
  initialValue: TokenStream;
  target: string;
  push: (ops: StreamOperation[] | TransformOperation[]) => void;
  tracker?: object;
}) {
  const editor = useEditorContext();

  const fieldId = useFieldId();
  const { libraries } = useClientConfig();

  const collab = useCollab();

  const [{ index }] = usePanel();

  React.useEffect(() => {
    const queue = collab
      .getTimeline(getDocumentId<DocumentId>(fieldId))!
      .getQueue<FieldTransactionEntry>(getRawFieldId(fieldId));

    const cache = createQueueCache(
      { stream: initialValue, transforms: [] },
      tracker
    );

    return queue.register(() => {
      // trackedForEach only adds any unique operation a single time.
      // Since we are using the bound register, it does not provide
      // the operations pushed from this specific field.

      let newOps: StreamOperation[] = [];

      const result = cache(queue.forEach, (prev, { transaction, trackers }) => {
        transaction.map((entry) => {
          if (entry[0] === target) {
            prev.stream = applyFieldTransaction(prev, entry).stream;
            if (!tracker || !trackers?.has(tracker)) {
              newOps.push(
                ...(entry[1] as StreamOperation[]).filter((el) =>
                  isSpliceOperation(el)
                )
              );
            }
          }
        });
        return prev;
      });

      if (!newOps.length) return;

      editor.update(() => $reconcile(editor, result.stream, libraries), {
        tag: RECONCILIATION_TAG,
      });
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

        const operations = getComputationDiff(prev, next);

        console.log("DIFF", operations);

        if (!operations) {
          return;
        }

        push(operations.map((el) => [...el]));
      }
    );
  }, [editor, push]);

  return null;
}

function $reconcile(
  editor: LexicalEditor,
  value: TokenStream,
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

    /*
    if (
      anchor !== null &&
      focus !== null &&
      document.activeElement === editor.getRootElement()
    ) {
      anchor = actions.reduce((acc: number, cur) => {
        if ("name" in cur) return acc;
        const [index, remove, insert] = cur;
        if (index > acc) return acc;
        return acc + tools.getLength(insert ?? []) - (remove ?? 0);
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

    */
    $setSelection(null);
  } catch (err) {
    console.error(err);
  }
}
