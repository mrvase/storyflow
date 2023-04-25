import { LexicalNode, NodeKey, SerializedTextNode, TextNode } from "lexical";
import { Spread } from "lexical";
import type { TokenStream } from "operations/types";

export type SerializedPromptNode = Spread<
  {
    type: "prompt";
    prompt: string;
    stream: TokenStream;
    version: 1;
  },
  SerializedTextNode
>;

type Initializer = "/" | "@" | "<";

export default class PromptNode extends TextNode {
  __stream: TokenStream;
  __initializer: Initializer;

  static getType(): string {
    return "prompt";
  }

  static clone(node: PromptNode): PromptNode {
    return new PromptNode(
      node.__initializer,
      node.__text,
      node.__stream,
      node.__key
    );
  }

  constructor(
    initializer: Initializer,
    text: string,
    stream: TokenStream,
    key?: NodeKey
  ) {
    super(text, key);
    this.__initializer = initializer;
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
    dom.classList.add("prompt-container");
    dom.setAttribute("data-initializer", this.__initializer);
    const text = this.__text;
    dom.textContent = text;
    return dom;
  }

  static importDOM(): null {
    return null;
  }

  static importJSON(serializedNode: SerializedPromptNode): PromptNode {
    const node = $createPromptNode(
      "/",
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
  initializer: Initializer,
  text: string,
  stream: TokenStream
): PromptNode {
  return new PromptNode(initializer, text, stream);
}

export function $isPromptNode(
  node: LexicalNode | null | undefined
): node is PromptNode {
  return node instanceof PromptNode;
}
