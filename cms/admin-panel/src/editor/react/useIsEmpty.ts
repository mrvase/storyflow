import { useLayoutEffect, useState } from "react";
import { $getRoot, $isParagraphNode, LexicalEditor } from "lexical";
import { $isHeadingNode } from "./HeadingNode";

export function $canShowPlaceholder(
  isComposing: boolean,
  isEditable: boolean
): boolean {
  const root = $getRoot();

  const rootTextContent = root.getTextContent();

  if (!isEditable || isComposing || rootTextContent !== "") {
    return false;
  }

  return true;

  /*
  const children = root.getChildren();
  const childrenLength = children.length;

  if (childrenLength > 1) {
    return false;
  }

  for (let i = 0; i < childrenLength; i++) {
    const topBlock = children[i];

    if ($isElementNode(topBlock)) {
      if (topBlock.__type !== "paragraph") {
        return false;
      }

      if (topBlock.__indent !== 0) {
        return false;
      }

      const topBlockChildren = topBlock.getChildren();
      const topBlockChildrenLength = topBlockChildren.length;

      for (let s = 0; s < topBlockChildrenLength; s++) {
        const child = topBlockChildren[i];

        if (!$isTextNode(child)) {
          return false;
        }
      }
    }
  }

  return true;
  */
}

export function isEditorEmpty(editor: LexicalEditor) {
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    const rootChildren = root.getChildren();
    return (
      !editor.isComposing() &&
      (rootChildren.length === 0 ||
        (rootChildren.length === 1 &&
          ($isHeadingNode(rootChildren[0]) ||
            $isParagraphNode(rootChildren[0])) &&
          rootChildren[0].getTextContent() === ""))
    );
  });
}

export function useIsEmpty(editor: LexicalEditor) {
  const [isEmpty, setIsEmpty] = useState(() => isEditorEmpty(editor));

  useLayoutEffect(() => {
    const reset = () => setIsEmpty(isEditorEmpty(editor));
    reset();
    return editor.registerUpdateListener(reset);
    /*
    return mergeRegister(
      editor.registerUpdateListener(reset),
      editor.registerEditableListener(reset)
    );
    */
  }, [editor]);

  return isEmpty;
}
