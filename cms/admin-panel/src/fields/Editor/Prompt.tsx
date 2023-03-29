import { TokenStream } from "@storyflow/backend/types";
import cl from "clsx";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  EditorState,
} from "lexical";
import React from "react";
import { tools } from "shared/editor-tools";
import { useClientConfig } from "../../client-config";
import { useEditorContext } from "../../editor/react/EditorProvider";
import PromptNode, {
  $createPromptNode,
  $isPromptNode,
} from "../decorators/PromptNode";
import { $replaceWithBlocks } from "./insertComputation";
import {
  $getBlocksFromComputation,
  $getComputation,
  $getIndexesFromSelection,
} from "./transforms";

export function Prompt() {
  const editor = useEditorContext();

  const [position, setPosition] = React.useState<{
    y: number;
    x: number;
  } | null>(null);
  const [prompt, setPrompt] = React.useState<string>("");
  const [stream, setStream] = React.useState<TokenStream | null>(null);

  const reset = () => {
    setPosition(null);
    setPrompt("");
    setStream(null);
  };

  const { libraries } = useClientConfig();

  React.useLayoutEffect(() => {
    const read = (editorState: EditorState) => {
      editorState.read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          reset();
          return;
        }

        const promptNode = selection
          .getNodes()
          .find((node): node is PromptNode => $isPromptNode(node));

        if (!promptNode) {
          reset();
          return;
        }

        const rootRect = editor.getRootElement()?.getBoundingClientRect();

        if (!rootRect) {
          reset();
          return;
        }

        const { y: rootY, x: rootX, width: rootWidth } = rootRect;

        const DOMNode: HTMLElement | null = editor.getElementByKey(
          promptNode.__key
        );

        if (!DOMNode) {
          reset();
          return;
        }

        const rect = DOMNode.getBoundingClientRect();
        const x = Math.max(Math.min(rect.x - rootX + 5, rootWidth - 672), 0);
        const y = rect.y + rect.height - rootY + 5;

        setPosition((ps) => {
          if (ps && ps.x === x && ps.y === y) {
            return ps;
          }
          return {
            x,
            y,
          };
        });
        const content = promptNode.getTextContent();
        const stream = promptNode.getTokenStream();
        setPrompt(content);
        setStream((ps) => ps ?? stream);
      });
    };

    return editor.registerUpdateListener(({ editorState }) =>
      read(editorState)
    );
  }, [editor]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !event.defaultPrevented) {
        event.preventDefault();
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
            return;
          }
          const [start, end] = $getIndexesFromSelection(selection);
          const streamFull = $getComputation($getRoot());
          const stream = tools.slice(streamFull, start, end);

          const paragraph = $createParagraphNode();
          const prompt = $createPromptNode("\uFEFF\uFEFF", stream);
          paragraph.append(prompt);
          $replaceWithBlocks(editor, [paragraph]);
          prompt.select(2, 2);
        });
        /*
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && selection.isCollapsed()) {
            selection.insertNodes([$createPromptNode("\uFEFF", [])]);
          }
        });
        */
      }
    }
    return editor.registerRootListener((next, prev) => {
      if (prev) {
        prev.removeEventListener("keydown", onKeyDown);
      }
      if (next) {
        next.addEventListener("keydown", onKeyDown);
      }
    });
  }, [editor]);

  React.useEffect(() => {
    return editor.registerNodeTransform(PromptNode, (node) => {
      if (node.getTextContent() === "\uFEFF") {
        const stream = node.getTokenStream();
        if (stream.length) {
          node.select(0, 1);
          $replaceWithBlocks(
            editor,
            $getBlocksFromComputation(stream, libraries)
          );
        } else {
          node.remove();
        }
      }
    });
  }, [editor]);

  React.useEffect(() => {
    return editor.registerMutationListener(PromptNode, (mutatedNodes) => {
      // mutatedNodes is a Map where each key is the NodeKey, and the value is the state of mutation.
      for (let [nodeKey, mutation] of mutatedNodes) {
        if (mutation === "destroyed") {
          console.log($getNodeByKey(nodeKey, editor.getEditorState()));
        }
        console.log(nodeKey, mutation);
      }
    });
  }, [editor]);

  return (
    <div
      className={cl(
        "absolute w-full left-[3.125rem] z-10 p-2.5 bg-gray-800 gradient-border rounded shadow-lg shadow-black/20 font-light text-sm max-w-2xl",
        position !== null
          ? "opacity-100 transition-opacity"
          : "opacity-0 pointer-events-none"
      )}
      style={
        position !== null
          ? { transform: `translate(${position.x}px, ${position.y}px)` }
          : undefined
      }
    >
      {stream && stream.length > 0 && (
        <div className="bg-gray-800 rounded p-2.5">
          {JSON.stringify(stream)}
        </div>
      )}
      {prompt}
    </div>
  );
}
