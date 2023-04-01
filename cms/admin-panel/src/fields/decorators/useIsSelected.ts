import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { mergeRegister } from "../../editor/utils/mergeRegister";
import { $selectNode } from "../Editor/transforms";

export const useIsSelected = (nodeKey: string) => {
  const editor = useEditorContext();
  const isFocused = useIsFocused();
  const [isSelected_, setIsSelected] = React.useState(false);
  const isSelected = isSelected_ && isFocused;
  const [isPseudoSelected, setIsPseudoSelected] = React.useState(false);

  const onDelete = React.useCallback(
    (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        const node = $getNodeByKey(nodeKey);
        if (node) {
          const sibling = node.getPreviousSibling();
          if ($isDecoratorNode(sibling)) {
            $selectNode(sibling.getKey());
          } else {
            node.selectPrevious();
          }
          node.remove();
        }
      }
      return false;
    },
    [isSelected, nodeKey]
  );

  React.useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const [isSelected, isPseudoSelected] = editorState.read(() => {
          const selection = $getSelection();
          let isSelected = false;
          let isPseudoSelected = false;
          if (
            $isNodeSelection(selection) ||
            ($isRangeSelection(selection) && !selection.isCollapsed())
          ) {
            isSelected = selection.getNodes().some((n) => n.__key === nodeKey);
          } else if (
            $isRangeSelection(selection) &&
            selection.isCollapsed() &&
            selection.anchor.type === "element"
          ) {
            const node =
              selection.anchor
                .getNode()
                ?.getChildAtIndex(selection.anchor.offset) ?? null;
            isPseudoSelected = node !== null && node.__key === nodeKey;
          }
          return [isSelected, isPseudoSelected];
        });

        setIsSelected(isSelected);
        setIsPseudoSelected(isPseudoSelected);
      }),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          setIsSelected(false);
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        onDelete,
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, nodeKey, onDelete]);

  const select = () => {
    editor.update(() => {
      $selectNode(nodeKey);
    });
  };

  return { isSelected, isPseudoSelected, select };
};
