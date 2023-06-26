import cl from "clsx";
import {
  $createParagraphNode,
  DecoratorNode,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  SerializedTextNode,
  TextNode,
} from "lexical";
import { Spread } from "lexical";
import type { TokenStream } from "../../../operations/types";
import { Spinner } from "../../../elements/Spinner";
import {
  CheckIcon,
  HandThumbUpIcon,
  StopCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCompletion } from "../../../utils/useCompletion";
import { useEditorContext } from "../../../editor/react/EditorProvider";
import React from "react";
import { useAppConfig } from "../../../AppConfigContext";
import { $replaceWithBlocks } from "../insertComputation";
import { $createBlocksFromStream, $selectNode } from "../transforms";

export type SerializedPromptNode = Spread<
  {
    type: "ai-completion";
    id: string;
    stream: TokenStream;
    version: 1;
  },
  SerializedLexicalNode
>;

type Initializer = "/" | "@" | "<";

export default class AICompletionNode extends DecoratorNode<React.ReactNode> {
  __id: string;
  __stream: TokenStream;

  static getType(): string {
    return "ai-completion";
  }

  static clone(node: AICompletionNode): AICompletionNode {
    return new AICompletionNode(node.__id, node.__stream, node.__key);
  }

  constructor(id: string, stream: TokenStream, key?: NodeKey) {
    super(key);
    this.__id = id;
    this.__stream = stream;
  }

  getTokenStream(): TokenStream {
    return this.getLatest().__stream;
  }

  getInitializer(): Initializer {
    return this.getLatest().__initializer;
  }

  createDOM(): HTMLSpanElement {
    const dom = document.createElement("span");
    dom.setAttribute("data-lexical-inline", "true");
    return dom;
  }

  static importDOM(): null {
    return null;
  }

  static importJSON(serializedNode: SerializedPromptNode): AICompletionNode {
    const node = $createAICompletionNode(
      serializedNode.id,
      serializedNode.stream
    );
    return node;
  }

  getTextContent(): string {
    return " ";
  }

  exportJSON(): SerializedPromptNode {
    const self = this.getLatest();
    return {
      ...super.exportJSON(),
      type: "ai-completion",
      id: self.__id,
      stream: this.getTokenStream(),
      version: 1,
    };
  }

  isInline() {
    return true;
  }

  decorate() {
    return (
      <Decorator id={this.__id} stream={this.__stream} nodeKey={this.__key} />
    );
  }
}

function Decorator({
  id,
  stream,
  nodeKey,
}: {
  id: string;
  stream: TokenStream;
  nodeKey: string;
}) {
  const { completion, isLoading } = useCompletion({
    id,
  });

  const [isAccepted, setIsAccepted] = React.useState(false);

  const Icon = isLoading ? Spinner : HandThumbUpIcon;

  const editor = useEditorContext();
  const { configs } = useAppConfig();

  const accept = () => {
    editor.update(() => {
      const node = editor.getEditorState()._nodeMap.get(nodeKey);
      if (!node) return;
      const parent = node.getParent()!;
      const nodes = completion.split("\n\n");
      const [first] = nodes.splice(0, 1);
      let newNode = new TextNode(first);
      node.replace(newNode);
      let prevBlock = parent;
      nodes.forEach((text) => {
        newNode = new TextNode(text);
        const nextBlock = $createParagraphNode().append(newNode);
        prevBlock.insertAfter(nextBlock);
        prevBlock = nextBlock;
      });
      newNode.select();
    });
  };

  const decline = () => {
    editor.update(() => {
      try {
        $selectNode(nodeKey);
        const blocks = $createBlocksFromStream(stream, configs);
        if (blocks.length === 0) {
          const node = editor.getEditorState()._nodeMap.get(nodeKey);
          if (!node) return;
          node.remove();
        } else {
          $replaceWithBlocks(blocks);
        }
      } catch (e) {
        console.log(e);
      }
    });
  };

  React.useEffect(() => {
    if (!isLoading && isAccepted) {
      accept();
    }
  }, [isAccepted, isLoading]);

  return (
    <span className="bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-200 rounded">
      <span className="absolute z-40 -mt-7 gap-2 magic-bg px-1 text-xs">
        <span className="inline-flex align-top mr-1 h-[1.5rem] py-1">
          <Icon className="w-[1.125rem] h-[1.125rem]" />
        </span>
        <span className="inline-flex align-top py-1">
          <span
            className={cl(
              "cursor-default inline-flex items-center text-red-100 p-0.5 rounded mr-1",
              isAccepted ? "bg-green-800" : "bg-white/10 hover:bg-green-800"
            )}
            onClick={isLoading ? () => setIsAccepted((ps) => !ps) : accept}
          >
            <CheckIcon className="w-3.5 h-3.5" />
          </span>
          <span
            className="cursor-default inline-flex items-center bg-white/10 hover:bg-red-800 text-red-100 p-0.5 rounded"
            onClick={decline}
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </span>
        </span>
      </span>
      {completion || "..."}
    </span>
  );
}

export function $createAICompletionNode(id: string, stream: TokenStream) {
  return new AICompletionNode(id, stream);
}

export function $isAICompletionNode(
  node: LexicalNode | null | undefined
): node is AICompletionNode {
  return node instanceof AICompletionNode;
}
