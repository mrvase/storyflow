import {
  $applyNodeReplacement,
  $createParagraphNode,
  DOMConversionMap,
  DOMConversionOutput,
  ElementNode,
  LexicalNode,
  NodeKey,
  ParagraphNode,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from "lexical";

export type HeadingTagType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function convertHeadingElement(domNode: Node): DOMConversionOutput {
  const nodeName = domNode.nodeName.toLowerCase();
  let node = null;
  if (
    nodeName === "h1" ||
    nodeName === "h2" ||
    nodeName === "h3" ||
    nodeName === "h4" ||
    nodeName === "h5" ||
    nodeName === "h6"
  ) {
    node = $createHeadingNode(nodeName);
  }
  return { node };
}

export type SerializedHeadingNode = Spread<
  {
    tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    type: "heading";
    version: 1;
  },
  SerializedElementNode
>;

export class HeadingNode extends ElementNode {
  __tag: HeadingTagType;

  static getType(): string {
    return "heading";
  }

  static clone(node: HeadingNode): HeadingNode {
    return new HeadingNode(node.__tag, node.__key);
  }

  constructor(tag: HeadingTagType, key?: NodeKey) {
    super(key);
    this.__tag = tag;
  }

  getTag(): HeadingTagType {
    return this.__tag;
  }

  // View

  createDOM(): HTMLElement {
    const tag = this.__tag;
    const element = document.createElement(tag);
    return element;
  }

  updateDOM(prevNode: HeadingNode, dom: HTMLElement): boolean {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      h1: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      h2: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      h3: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      h4: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      h5: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      h6: (node: Node) => ({
        conversion: convertHeadingElement,
        priority: 0,
      }),
      p: (node: Node) => {
        // domNode is a <p> since we matched it by nodeName
        const paragraph = node as HTMLParagraphElement;
        const firstChild = paragraph.firstChild;
        if (firstChild !== null && isGoogleDocsTitle(firstChild)) {
          return {
            conversion: () => ({ node: null }),
            priority: 3,
          };
        }
        return null;
      },
      span: (node: Node) => {
        if (isGoogleDocsTitle(node)) {
          return {
            conversion: (domNode: Node) => {
              return {
                node: $createHeadingNode("h1"),
              };
            },
            priority: 3,
          };
        }
        return null;
      },
    };
  }
  static importJSON(serializedNode: SerializedHeadingNode): HeadingNode {
    const node = $createHeadingNode(serializedNode.tag);
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON(): SerializedHeadingNode {
    return {
      ...super.exportJSON(),
      tag: this.getTag(),
      type: "heading",
      version: 1,
    };
  }

  // Mutation
  insertNewAfter(
    selection?: RangeSelection,
    restoreSelection = true
  ): ParagraphNode | HeadingNode {
    const anchorOffet = selection ? selection.anchor.offset : 0;
    const newElement =
      anchorOffet > 0 && anchorOffet < this.getTextContentSize()
        ? $createHeadingNode(this.getTag())
        : $createParagraphNode();
    const direction = this.getDirection();
    newElement.setDirection(direction);
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  collapseAtStart(): true {
    const newElement = !this.isEmpty()
      ? $createHeadingNode(this.getTag())
      : $createParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => newElement.append(child));
    this.replace(newElement);
    return true;
  }

  extractWithChild(): boolean {
    return true;
  }
}

function isGoogleDocsTitle(domNode: Node): boolean {
  if (domNode.nodeName.toLowerCase() === "span") {
    return (domNode as HTMLSpanElement).style.fontSize === "26pt";
  }
  return false;
}

export function $createHeadingNode(headingTag: HeadingTagType): HeadingNode {
  return $applyNodeReplacement(new HeadingNode(headingTag));
}

export function $isHeadingNode(
  node: LexicalNode | null | undefined
): node is HeadingNode {
  return node instanceof HeadingNode;
}
