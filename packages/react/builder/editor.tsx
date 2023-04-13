import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  createEditor,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  FORMAT_TEXT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  LexicalEditor,
  REMOVE_TEXT_COMMAND,
} from "lexical";
import * as React from "react";

const EditorContext = React.createContext<LexicalEditor | null>(null);

export function useEditorContext() {
  return React.useContext(EditorContext);
}

function registerPlainText(editor: LexicalEditor): () => void {
  const removeListener = mergeRegister(
    editor.registerCommand<boolean>(
      DELETE_CHARACTER_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        selection.deleteCharacter(isBackward);

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<boolean>(
      DELETE_WORD_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        selection.deleteWord(isBackward);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<boolean>(
      DELETE_LINE_COMMAND,
      (isBackward) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        selection.deleteLine(isBackward);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand(
      REMOVE_TEXT_COMMAND,
      () => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        // calls insertText("")
        selection.removeText();
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand(
      FORMAT_TEXT_COMMAND,
      (format) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        // we block attempts to mark elements as bold right now
        // (even inline ones), as it is not yet supported.
        const nodes = selection.getNodes();
        if (nodes.some((el) => !$isTextNode(el))) {
          return false;
        }
        selection.formatText(format);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<InputEvent | string>(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (eventOrText) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        if (typeof eventOrText === "string") {
          selection.insertText(eventOrText);
        } else {
          const dataTransfer = eventOrText.dataTransfer;

          if (dataTransfer != null) {
            const text = dataTransfer.getData("text/plain");

            if (text != null) {
              selection.insertRawText(text);
            }
          } else {
            const data = eventOrText.data;

            if (data) {
              selection.insertText(data);
            }
          }
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        event.preventDefault();
        return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
      },
      COMMAND_PRIORITY_EDITOR
    ),
    editor.registerCommand<KeyboardEvent>(
      KEY_DELETE_COMMAND,
      (event) => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return false;
        }

        event.preventDefault();
        return editor.dispatchCommand(DELETE_CHARACTER_COMMAND, false);
      },
      COMMAND_PRIORITY_EDITOR
    )
  );
  return removeListener;
}

export function EditorProvider({
  children,
  string,
}: {
  children: React.ReactNode;
  string: string;
}): JSX.Element {
  const parent = React.useContext(EditorContext);

  const editor = React.useMemo(() => {
    const editor = createEditor({
      editable: false,
      namespace: "editor",
      nodes: [],
      onError: (error) => {},
      parentEditor: parent || undefined,
    });

    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const p = $createParagraphNode();
      const text = $createTextNode(string);
      p.append(text);
      root.append(p);
    });

    return editor;
  }, [parent]);

  React.useLayoutEffect(() => {
    return registerPlainText(editor);
  }, [editor]);

  React.useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        editor.setEditable(false);
        return false;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  );
}

export function NoEditor({ children }: { children: React.ReactNode }) {
  return (
    <EditorContext.Provider value={null}>{children}</EditorContext.Provider>
  );
}
