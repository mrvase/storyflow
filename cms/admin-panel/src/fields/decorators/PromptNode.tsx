import { LexicalNode, NodeKey, SerializedTextNode, TextNode } from "lexical";
import { $applyNodeReplacement, Spread } from "lexical";
import { TokenStream } from "@storyflow/backend/types";

export type SerializedPromptNode = Spread<
  {
    type: "prompt";
    prompt: string;
    stream: TokenStream;
    version: 1;
  },
  SerializedTextNode
>;

export default class PromptNode extends TextNode {
  __stream: TokenStream;

  static getType(): string {
    return "prompt";
  }

  static clone(node: PromptNode): PromptNode {
    return new PromptNode(node.__text, node.__stream, node.__key);
  }

  constructor(text: string, stream: TokenStream, key?: NodeKey) {
    super(text, key);
    this.__stream = stream;
  }

  getTokenStream(): TokenStream {
    return this.getLatest().__stream;
  }

  createDOM(): HTMLSpanElement {
    const dom = document.createElement("span");
    dom.classList.add("prompt-container");
    const text = this.__text;
    dom.textContent = text;
    return dom;
  }

  static importDOM(): null {
    return null;
  }

  static importJSON(serializedNode: SerializedPromptNode): PromptNode {
    const node = $createPromptNode(
      serializedNode.prompt,
      serializedNode.stream
    );
    return node;
  }

  exportJSON(): SerializedPromptNode {
    return {
      ...super.exportJSON(),
      type: "prompt",
      prompt: this.getTextContent(),
      stream: this.getTokenStream(),
      version: 1,
    };
  }
}

export function $createPromptNode(
  text: string,
  stream: TokenStream
): PromptNode {
  return new PromptNode(text, stream);
}

export function $isPromptNode(
  node: LexicalNode | null | undefined
): node is PromptNode {
  return node instanceof PromptNode;
}
