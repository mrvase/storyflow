import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
} from "lexical";
import React from "react";
import $createRangeSelection from "../../editor/createRangeSelection";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { $getIndexFromPoint, $getPointFromIndex } from "../Editor/transforms";

export type HoldActions = {
  hold: () => void;
  release: () => void;
};

export const useRestorableSelection = () => {
  const editor = useEditorContext();
  const [savedSelection, setSavedSelection] = React.useState<number | null>(
    null
  );

  const hold = React.useRef(false);

  const actions: HoldActions = React.useMemo(
    () => ({
      hold() {
        hold.current = true;
        const result = editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return null;
          return $getIndexFromPoint(selection.anchor);
        });
        setSavedSelection(result);
      },
      async release() {
        hold.current = false;
        if (!savedSelection) return;
        await new Promise((resolve, reject) =>
          editor.update(() => {
            try {
              const [anchorNode, anchorOffset] = $getPointFromIndex(
                "cursor",
                savedSelection
              );
              if ($isTextNode(anchorNode)) {
                const point = { node: anchorNode, offset: anchorOffset };
                const newSelection = $createRangeSelection(point, point);
                $setSelection(newSelection);
                resolve(true);
              } else {
                resolve(false);
              }
            } catch (err) {
              reject();
            }
          })
        );
        setSavedSelection(null);
      },
    }),
    [editor, savedSelection]
  );

  return [hold, actions] as [typeof hold, typeof actions];
};
