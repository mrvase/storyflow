import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  FOCUS_COMMAND,
  LexicalEditor,
} from "lexical";
import React from "react";
import { mergeRegister } from "../utils/mergeRegister";

function isEditorSelected(editor: LexicalEditor) {
  return document?.activeElement === editor.getRootElement();
}

export function useIsFocused(editor: LexicalEditor) {
  const [isFocused, setIsFocused] = React.useState(() =>
    isEditorSelected(editor)
  );

  React.useEffect(() => {
    const updateFocus = () => {
      setIsFocused(isEditorSelected(editor));
      return false;
    };
    return mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        updateFocus,
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(BLUR_COMMAND, updateFocus, COMMAND_PRIORITY_EDITOR)
    );
  }, [editor]);

  return isFocused;
}
