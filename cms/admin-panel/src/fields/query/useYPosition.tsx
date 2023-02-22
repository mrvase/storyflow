import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  EditorState,
  LexicalEditor,
} from "lexical";
import React from "react";

export const useYPosition = (editor: LexicalEditor, show: boolean) => {
  const [y, setY] = React.useState(0);

  React.useLayoutEffect(() => {
    const read = (editorState: EditorState) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const rootY = editor.getRootElement()?.getBoundingClientRect()?.y;
          if (typeof rootY !== "number") return;
          const key = selection.anchor.key;
          const DOMNode: HTMLElement | null = editor.getElementByKey(key);
          if (!DOMNode) return;
          try {
            const range = document.createRange();

            let textY = 0;
            let textHeight = 0;

            const child = DOMNode.firstChild!;
            if (child.nodeType === Node.TEXT_NODE) {
              const offset = Math.max(
                selection.anchor.offset,
                selection.focus.offset
              );

              range.setStart(DOMNode.firstChild!, offset);
              range.collapse(true);
              const rangeRect = range.getBoundingClientRect();
              textY = rangeRect.y;
              textHeight = rangeRect.height;
            } else {
              const rect = DOMNode.getBoundingClientRect();
              textY = rect.y;
              textHeight = rect.height;
            }
            setY(textY + textHeight - rootY + 8);
          } catch (err) {
            console.error(err);
          }
        } else if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          if (nodes.length !== 1) return;
          const [node] = nodes;
          const DOMNode = editor.getElementByKey(node.__key);
          const EditorNode = editor.getRootElement();
          if (!DOMNode || !EditorNode) return;
          const editorRect = EditorNode.getBoundingClientRect();
          const nodeRect = DOMNode.getBoundingClientRect();
          setY(nodeRect.y + nodeRect.height - editorRect.y + 8);
        }
      });
    };

    if (show) {
      read(editor.getEditorState());
      return editor.registerUpdateListener(({ editorState }) =>
        read(editorState)
      );
    }
  }, [editor, show]);

  return y;
};
