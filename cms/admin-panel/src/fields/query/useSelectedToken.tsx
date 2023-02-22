import { Token } from "@storyflow/backend/types";
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  EditorState,
  FOCUS_COMMAND,
} from "lexical";
import React from "react";
import { $isTokenNode, TokenNode } from "../decorators/TokenNode";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { mergeRegister } from "../../editor/utils/mergeRegister";

export const useSelectedToken = (callback: (token: Token) => void) => {
  const [tokenNode, setTokenNode] = React.useState<{
    key: string;
    value: Token;
  }>();

  const editor = useEditorContext();

  React.useEffect(() => {
    const update = (editorState: EditorState) => {
      const state = editorState.read(() => {
        const selection = $getSelection();

        if (!$isNodeSelection(selection)) return;
        const nodes = selection.getNodes();
        if (nodes.length !== 1) return;
        const [node] = nodes;

        if (!$isTokenNode(node)) return;

        return {
          value: node.getToken(),
          key: node.__key,
        };
      });

      if (state) callback(state.value);
      if (!state) console.log("setting to undefined");
      setTokenNode(state);
    };
    return mergeRegister(
      editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          console.log("focus");
          update(editor.getEditorState());
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          console.log("blur");
          setTokenNode(undefined);
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerUpdateListener(({ editorState }) => {
        console.log("update");
        update(editorState);
      })
    );
  }, [editor]);

  const token = tokenNode?.value;

  const setToken = (value: Token) => {
    if (!tokenNode) return;
    editor.update(() => {
      const node = $getNodeByKey(tokenNode.key) as TokenNode | null;
      node?.setToken(value);
    });
  };

  console.log("TOKEN", token);

  return [token, setToken] as [typeof token, typeof setToken];
};
