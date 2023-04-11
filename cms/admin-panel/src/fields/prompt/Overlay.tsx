import { mergeRegister } from "../../editor/utils/mergeRegister";
import cl from "clsx";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  LexicalNode,
} from "lexical";
import React from "react";
import { tools } from "shared/editor-tools";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { $isColorNode } from "../Editor/decorators/ColorNode";
import PromptNode, {
  $createPromptNode,
  $isPromptNode,
} from "../Editor/decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import {
  $getComputation,
  $getIndexesFromSelection,
} from "../Editor/transforms";
import { ColorOverlay } from "./ColorOverlay";
import { Prompt } from "./Prompt";
import { useRestorableSelection } from "./useRestorableSelection";

const matchers: ((
  node: LexicalNode
) => { type: string; prompt: string } | undefined)[] = [
  (node: LexicalNode) => {
    if ($isPromptNode(node)) {
      return {
        type: "prompt",
        prompt: node.getTextContent().replace(/\uFEFF/g, ""),
      };
    }
  },
  (node: LexicalNode) => {
    if ($isColorNode(node)) {
      return {
        type: "color",
        prompt: "",
      };
    }
  },
];

export function Overlay({ children }: { children?: React.ReactNode }) {
  const editor = useEditorContext();

  const [type, setType] = React.useState<string | null>(null);
  const [node, setNode] = React.useState<LexicalNode | null>(null);
  const [prompt, setPrompt] = React.useState<string>("");
  const [position, setPosition] = React.useState<{
    y: number;
    x: number;
  } | null>(null);

  const isOpen = position !== null;

  const reset = () => {
    setType(null);
    setNode(null);
    setPosition(null);
    setPrompt("");
  };

  const [isHolded, holdActions] = useRestorableSelection();

  React.useLayoutEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        if (isHolded.current) return;

        const selection = $getSelection();

        if (!$isNodeSelection(selection) && !$isRangeSelection(selection)) {
          reset();
          return;
        }

        let nodes = selection.getNodes();

        if (nodes.length > 1) {
          reset();
          return;
        }

        let node = nodes[0];

        let match: { type: string; prompt: string } | undefined;

        for (const matcher of matchers) {
          match = matcher(node);
          if (match !== undefined) {
            break;
          }
        }

        if (match === undefined) {
          reset();
          return;
        }

        const rootRect = editor.getRootElement()?.getBoundingClientRect();

        if (!rootRect) {
          reset();
          return;
        }

        const { y: rootY, x: rootX, width: rootWidth } = rootRect;

        const DOMNode: HTMLElement | null = editor.getElementByKey(node.__key);

        console.log("DOM NODE", DOMNode, rootY, rootX);

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
        setNode(node);
        setType(match.type);
        setPrompt(match.prompt);
      });
    });
  }, [editor, isHolded]);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        BLUR_COMMAND,
        () => {
          if (isHolded.current) return false;
          reset();
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, isHolded]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (["/", "<", "@"].includes(event.key) && !event.defaultPrevented) {
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
          const prompt = $createPromptNode(
            event.key as "/",
            "\uFEFF\uFEFF",
            stream
          );
          paragraph.append(prompt);
          $replaceWithBlocks(editor, [paragraph]);
          prompt.select(2, 2);
        });
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

  return (
    <div
      className={cl(
        "absolute w-full top-0 -left-1.5 z-10 gradient-border rounded shadow-lg shadow-black/20 font-light text-sm max-w-2xl",
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
      <div className="max-h-72 overflow-y-auto no-scrollbar m-[1px]">
        {type === "prompt" && (
          <Prompt
            node={node as PromptNode}
            prompt={prompt!}
            holdActions={holdActions}
          >
            {children}
          </Prompt>
        )}
        {type === "color" && <ColorOverlay />}
      </div>
    </div>
  );
}
