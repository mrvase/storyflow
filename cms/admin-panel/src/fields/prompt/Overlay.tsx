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
import React, { useId } from "react";
import { tools } from "../../operations/stream-methods";
import { useEditorContext } from "../../editor/react/EditorProvider";
import ColorNode, { $isColorNode } from "../Editor/decorators/ColorNode";
import PromptNode, {
  $createPromptNode,
  $isPromptNode,
} from "../Editor/decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import {
  $createBlocksFromStream,
  $getComputation,
  $getIndexesFromSelection,
} from "../Editor/transforms";
import { ColorOverlay } from "./ColorOverlay";
import { PromptOverlay } from "./PromptOverlay";
import { HoldActions, useRestorableSelection } from "./useRestorableSelection";
import FileNode, { $isFileNode } from "../Editor/decorators/FileNode";
import { Options, OptionEventsPlugin } from "./OptionsContext";
import { FilePrompt } from "./FilePrompt";
import type { FileToken, Option as OptionType } from "@storyflow/shared/types";
import type { TokenStream } from "../../operations/types";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useFieldOptions, useFieldRestriction } from "../FieldIdContext";
import { useAppConfig } from "../../AppConfigContext";
import CustomTokenNode, {
  $isCustomTokenNode,
} from "../Editor/decorators/CustomTokenNode";
import { OptionsPrompt } from "./OptionsPrompt";
import { $exitPromptNode } from "./utils";
import { $createAICompletionNode } from "../Editor/decorators/AICompletionNode";
import { createKey } from "../../utils/createKey";

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
    if ($isCustomTokenNode(node)) {
      return {
        type: "custom",
        prompt: "",
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
  (node: LexicalNode) => {
    if ($isFileNode(node)) {
      return {
        type: "file",
        prompt: "",
      };
    }
  },
];

export function Overlay({ children }: { children?: React.ReactNode }) {
  const editor = useEditorContext();

  const generatorId = React.useState(() => createKey())[0];

  const [type, setType] = React.useState<string | null>(null);

  const [node, setNode] = React.useState<LexicalNode | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [position, setPosition] = React.useState<{
    y: number;
    x: number;
  } | null>(null);

  const { configs } = useAppConfig();

  const reset = React.useCallback(() => {
    if ($isPromptNode(node)) {
      if (editor.getEditorState()._nodeMap.has(node.__key)) {
        // we check if the node is still in the editor state.
        // If not, it has probably been removed with registerNodeTransform
        // in PromptOverlay. If we did not do this check, we would enter
        // an infinite loop.
        editor.update(() => {
          // if AI is generating, we replace the node with AI node
          if (node.getIsGenerating()) {
            node.replace(
              $createAICompletionNode(generatorId, node.getTokenStream())
            );
          } else {
            $exitPromptNode(configs, node);
          }
        });
      }
    }
    setType(null);
    setNode(null);
    setPosition(null);
    setPrompt("");
  }, [editor, node]);

  const [isHolded, holdActions] = useRestorableSelection();

  const restrictTo = useFieldRestriction();
  const options = useFieldOptions();
  const isFocused = useIsFocused();

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

        let node = nodes[0] as LexicalNode;
        let newNode: LexicalNode | null = null;

        let match: { type: string; prompt: string } | undefined;

        for (const matcher of matchers) {
          match = matcher(node);
          if (match !== undefined) {
            newNode = node;
            break;
          }
        }

        if (
          match === undefined &&
          (!["file", "color"].includes(restrictTo!) || !isFocused) &&
          (!["string", "number"].includes(restrictTo!) ||
            !options ||
            !isFocused)
        ) {
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
        setNode(newNode);

        if (match) {
          setType(match.type);
          setPrompt(match.prompt);
        }
      });
    });
  }, [reset, editor, isHolded, restrictTo, isFocused]);

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
  }, [reset, editor, isHolded]);

  const promptIsOpen = type === "prompt";

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const keys = ["/", "@"];
      if (restrictTo === "children") {
        keys.push("<");
      }

      if (keys.includes(event.key) && !event.defaultPrevented) {
        event.stopPropagation();
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
          $replaceWithBlocks([paragraph]);
          prompt.select(2, 2);
        });
      }
    }

    if (promptIsOpen || !isFocused) return;

    return editor.registerRootListener((next, prev) => {
      if (prev) {
        prev.removeEventListener("keydown", onKeyDown);
      }
      if (next) {
        next.addEventListener("keydown", onKeyDown);
      }
    });
  }, [editor, promptIsOpen, isFocused, restrictTo]);

  const getChild = () => {
    if (type === "prompt") {
      return (
        <PromptOverlay
          node={node as PromptNode}
          prompt={prompt!}
          generatorId={generatorId}
          holdActions={holdActions}
        >
          {children}
        </PromptOverlay>
      );
    } else if (type === "color" || (restrictTo === "color" && isFocused)) {
      return <ColorOverlay node={node as ColorNode} />;
    } else if (type === "file" || (restrictTo === "image" && isFocused)) {
      return <FileOverlay node={node as FileNode} holdActions={holdActions} />;
    } else if (
      (type === "custom" || ["string", "number"].includes(restrictTo!)) &&
      options &&
      isFocused
    ) {
      return (
        <OptionsOverlay node={node as CustomTokenNode} options={options} />
      );
    }
  };

  return (
    <div
      className={cl(
        "absolute w-full top-0 -left-1.5 z-[60] gradient-border rounded shadow-lg shadow-black/20 text-sm max-w-2xl",
        "flex flex-col divide-y divide-white/5",
        "text-gray-850 dark:text-white", // have to be here because text in default field is dimmed
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
      {getChild()}
    </div>
  );
}

function FileOverlay({
  node,
  holdActions,
}: {
  node?: FileNode;
  holdActions: HoldActions;
}) {
  const editor = useEditorContext();
  const { configs } = useAppConfig();

  const replacePromptWithStream = React.useCallback(
    (stream: TokenStream) => {
      editor.update(() => {
        const token = stream[0] as FileToken;
        if (node) {
          node.setToken(token);
        } else {
          const blocks = $createBlocksFromStream(stream, configs);
          $replaceWithBlocks(blocks);
        }
      });
    },
    [editor, node, configs]
  );

  return (
    <Options>
      <OptionEventsPlugin />
      <FilePrompt
        prompt=""
        holdActions={holdActions}
        replacePromptWithStream={replacePromptWithStream}
      />
    </Options>
  );
}

function OptionsOverlay({
  node,
  options,
}: {
  node?: CustomTokenNode;
  options: OptionType[];
}) {
  return (
    <Options>
      <OptionEventsPlugin />
      <OptionsPrompt options={options} node={node} />
    </Options>
  );
}
