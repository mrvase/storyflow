import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  FOCUS_COMMAND,
  LexicalEditor,
} from "lexical";
import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { mergeRegister } from "../utils/mergeRegister";
import { useEditorContext } from "./EditorProvider";

const EditorFocusContext = React.createContext<
  [boolean, React.Dispatch<boolean>] | null
>(null);

export function EditorFocusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState(false);
  return (
    <EditorFocusContext.Provider value={state}>
      {children}
    </EditorFocusContext.Provider>
  );
}

export function EditorFocusPlugin() {
  const editor = useEditorContext();

  const [, setIsFocused] = useContextWithError(
    EditorFocusContext,
    "EditorFocus"
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

  React.useLayoutEffect(() => {
    // set initial focus
    setIsFocused(isEditorSelected(editor));
  }, []);

  return null;
}

export function useIsFocused(): boolean {
  return useContextWithError(EditorFocusContext, "EditorFocus")[0];
}

function isEditorSelected(editor: LexicalEditor) {
  return document?.activeElement === editor.getRootElement();
}

/*
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
*/
