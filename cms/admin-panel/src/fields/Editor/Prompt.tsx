import {
  CalendarDaysIcon,
  CheckIcon,
  CubeIcon,
  CursorArrowRaysIcon,
  DocumentIcon,
  LinkIcon,
  PhotoIcon,
  SwatchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { TokenStream } from "@storyflow/backend/types";
import cl from "clsx";
import {
  $createParagraphNode,
  $createTextNode,
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

  const isOpen = position !== null;

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
    if (!isOpen) {
      return editor.registerRootListener((next, prev) => {
        if (prev) {
          prev.removeEventListener("keydown", onKeyDown);
        }
        if (next) {
          next.addEventListener("keydown", onKeyDown);
        }
      });
    }
  }, [editor, isOpen]);

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
      } else if (node.getTextContent() === "\uFEFF\uFEFF/") {
        node.select(0, 3);
        const p = $createParagraphNode();
        p.append($createTextNode("/"));
        $replaceWithBlocks(editor, [p]);
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

  const panes = [
    {
      icon: CursorArrowRaysIcon,
      label: "Handlinger",
    },
    {
      icon: CubeIcon,
      label: "Elementer",
    },
    {
      icon: DocumentIcon,
      label: "Dokumenter",
    },
    {
      icon: LinkIcon,
      label: "URLS",
    },
    {
      icon: PhotoIcon,
      label: "Billeder",
    },
  ];

  return (
    <div
      className={cl(
        "absolute w-full left-[3.125rem] z-10 bg-gray-800 gradient-border rounded shadow-lg shadow-black/20 font-light text-sm max-w-2xl",
        "flex flex-col divide-y divide-white/5",
        position !== null
          ? "opacity-100 transition-opacity duration-300"
          : "opacity-0 pointer-events-none"
      )}
      style={
        position !== null
          ? { transform: `translate(${position.x}px, ${position.y}px)` }
          : undefined
      }
    >
      <div className="grid grid-cols-5 gap-2.5 p-2.5 text-xs">
        {panes.map((pane, index) => (
          <div
            key={index}
            className={cl(
              "flex-center gap-2 rounded cursor-default py-2 px-3 transition-opacity",
              index === 0 ? "bg-gray-800" : "opacity-50 hover:opacity-100"
            )}
          >
            <pane.icon className="w-4 h-4" />
            {pane.label}
          </div>
        ))}
      </div>
      {stream && stream.length > 0 ? (
        <div className="p-2.5">
          <div className="bg-yellow-500/20 text-yellow-200 rounded p-2.5">
            {JSON.stringify(stream)}
          </div>
        </div>
      ) : (
        <>
          <div className="p-2.5">
            <div className="p-2.5 rounded flex items-center gap-2">
              <div className="cursor-default bg-gradient-to-b from-cyan-600 to-cyan-700 shadow-sm text-sky-100/90 rounded px-2 py-0.5 flex-center gap-2">
                <CalendarDaysIcon className="w-4 h-4 inline" />
                25. marts 2023
              </div>
              <div className="cursor-default bg-gradient-to-b dark:bg-white shadow-sm text-black rounded px-2 py-0.5 flex-center gap-2">
                <SwatchIcon className="w-4 h-4 inline" />
                White
              </div>
              <div className="cursor-default bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-sm text-green-100/90 rounded px-2 py-0.5 flex-center gap-2">
                <CheckIcon className="w-4 h-4 inline" />
                Sand
              </div>
              <div className="cursor-default bg-gradient-to-b from-pink-600 to-pink-700 shadow-sm text-red-100/90 rounded px-2 py-0.5 flex-center gap-2">
                <XMarkIcon className="w-4 h-4 inline" />
                Falsk
              </div>
            </div>
          </div>
          <div className="p-2.5">
            <div className="font-normal opacity-50 mb-1">Formater afsnit</div>
            <div className="p-2.5 bg-white/5 rounded">Overskrift 1</div>
            <div className="p-2.5 rounded">Overskrift 2</div>
            <div className="p-2.5 rounded">Overskrift 3</div>
          </div>
        </>
      )}
    </div>
  );
}
