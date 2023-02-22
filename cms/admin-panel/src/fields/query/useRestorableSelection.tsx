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

export const useRestorableSelection = () => {
  const [savedSelection, setSavedSelection] = React.useState<number | null>(
    null
  );

  const editor = useEditorContext();

  const hold = React.useCallback(() => {
    const result = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      return $getIndexFromPoint(selection.anchor);
    });
    setSavedSelection(result);
  }, [editor]);

  const restore = React.useCallback(async () => {
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
  }, [editor, savedSelection]);

  const actions = React.useMemo(() => ({ hold, restore }), [hold, restore]);

  return [Boolean(savedSelection), actions] as [boolean, typeof actions];
};
