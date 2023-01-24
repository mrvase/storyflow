import React from "react";
import { useEditorContext } from "./EditorProvider";
import useLayoutEffect from "./useLayoutEffect";

export const useIsEditable = () => {
  const editor = useEditorContext();

  const [isEditable, setEditable] = React.useState(false);

  useLayoutEffect(() => {
    setEditable(editor.isEditable());
    return editor.registerEditableListener((currentIsEditable) => {
      setEditable(currentIsEditable);
    });
  }, [editor]);

  return isEditable;
};
