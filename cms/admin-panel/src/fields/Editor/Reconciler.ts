import { QueueListener } from "@storyflow/state";
import {
  $getRoot,
  $getSelection,
  $isTextNode,
  $setSelection,
  LexicalEditor,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../client-config";
import $createRangeSelection from "../../editor/createRangeSelection";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { getComputationDiff } from "../../editor/utils/getComputationDiff";
import { tools } from "shared/editor-tools";
import { getNextState } from "shared/computation-tools";
import { InferAction, Target, ComputationOp } from "shared/operations";
import { createQueueCache } from "../../state/collaboration";
import { EditorComputation, FunctionName } from "@storyflow/backend/types";
import { LibraryConfig } from "@storyflow/frontend/types";
import {
  $clearEditor,
  $getComputation,
  $getIndexesFromSelection,
  $getPointFromIndex,
  $initializeEditor,
  $isSelection,
} from "./transforms";

export function Reconciler({
  target,
  initialValue,
  push,
  register,
  setValue,
  transform,
}: {
  initialValue: EditorComputation;
  // history: CollabHistory<TextOp | FunctionOp>;
  target: Target;
  push: (ops: ComputationOp["ops"], tags: Set<string>) => void;
  register: (listener: QueueListener<ComputationOp>) => () => void;
  setValue: (value: () => EditorComputation) => void;
  transform?: FunctionName;
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

      let update = false;

      const result = cache(forEach, (prev, { operation }) => {
        if (operation.target === target) {
          prev = getNextState(prev, operation);
          update = true;
        }
        return prev;
      });

      if (newOps.length > 0) {
        reconcile(editor, result, newOps, libraries);
      }

      if (update) {
        setValue(() => result);
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

        push(
          action.map((el) => ({ ...el })),
          tags
        );
      }
    );
  }, [editor, push]);

  return null;
}

function reconcile(
  editor: LexicalEditor,
  value: EditorComputation,
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

      /** UPDATE CONTENT */
      $clearEditor();
      $initializeEditor(value, libraries);

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
  // FOR EXTERNAL CHANGES
  // take in text result of all current actions
  // in the same update:
  // compare to current text result of editor
  // make changes accordingly, paragraph by paragraph
  // (we could have just replaced the entire dom, but we need the perf)
  //
  // alg:
  // what we will and will not achieve
  // - it will keep blocks that have not changed
  // - it will not keep blocks that have been swapped although not changed otherwise
  // - it will replace the dom elements of changed blocks entirely
  //
  // map: [block, [indexes]]
  //
  // alt:
  // run through them all first and create map
  // gå igennem alle igen (lad os sige, der er fire)
  // 1 [1, x, x, x] - ved første: tag dens laveste indeks // finder i Map med O(1)
  // 2 [3, 1, x, x] - tag dens laveste indeks efter 1 og dens laveste indeks i det hele taget
  // 3 [x, 2, 2, x] - det sidste 2 kunne være et u for: kan ikke gøre det bedre.
  // 4 [x, 4, 4, 1]
  // nu summer jeg hvor mange der findes i hver kolonne og tager den kolonne med flest
  // i dette tilfælde er det kolonne 3. Så det er mit map.
  // 1 => x, 2 => 1, 3 => 2, 4 => 4
  // Den er lige nu:
  // [tom]
  // [tom]
  // hej
  // [tom]
  //
  // Den skal blive:
  // [tom]
  // hej
  // bla
  // [tom]
  //
  // Operationer
  // - sletter x'ere
  //   1 => 1, 2 => 2, 3 => 4
  // - fra bunden: Indsætter de felter, der ikke er fundet
  //   1 => 1, 2 => 2, 3 => ny, 4 => 4
  // pengene passer
}
