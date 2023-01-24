import React from "react";
import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";

function FunctionDecorator({
  type,
  nodeKey,
}: {
  type: string;
  nodeKey: string;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const open = (
    <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
      <path
        d="M4,0 A 10 10 0 0 0 4 16 A 20 20 0 0 1 4 0"
        className={cl("fill-amber-500")}
      />
    </svg>
  );

  const label =
    {
      c: "join",
      u: "url",
    }[type] ?? "";

  return (
    <span
      className={cl(
        "relative flex-center selection:bg-transparent text-xs text-gray-800",
        isSelected && "ring-2 ring-amber-300",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => select()}
    >
      <span className="flex-center px-2 bg-amber-500 text-white rounded-full mr-1">
        {label}
      </span>{" "}
      <span className="flex-center w-[6px] h-6">{open}</span>
    </span>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  const textContent = domNode.textContent;

  if (textContent !== null) {
    const node = $createFunctionNode(textContent);
    return {
      node,
    };
  }

  return null;
}

export type SerializedFunctionNode = Spread<
  {
    type: "function";
    text: string;
  },
  SerializedLexicalNode
>;

export class FunctionNode extends DecoratorNode<React.ReactNode> {
  __text: string;
  __func: string;

  static getType(): string {
    return "function";
  }

  static clone(node: FunctionNode): FunctionNode {
    return new FunctionNode(node.__text, node.__key);
  }

  constructor(text: string, key?: NodeKey) {
    super(key);
    this.__text = "[";
    this.__func = text;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    const self = this.getLatest();
    return self.__text;
  }

  static importJSON(
    serializedFunctionNode: SerializedFunctionNode
  ): FunctionNode {
    return $createFunctionNode(serializedFunctionNode.text);
  }

  exportJSON(): SerializedFunctionNode {
    return {
      type: "function",
      text: this.getTextContent(),
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-function", "true");
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-function")) {
          return null as any;
        }
        return {
          conversion: convertImportElement,
          priority: 1,
        };
      },
    };
  }

  decorate(): React.ReactNode {
    return <FunctionDecorator type={this.__func} nodeKey={this.__key} />;
  }
}

export function $createFunctionNode(text: string): FunctionNode {
  return new FunctionNode(text);
}

export function $isFunctionNode(node: LexicalNode): boolean {
  return node instanceof FunctionNode;
}
