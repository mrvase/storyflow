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

function OperatorDecorator({
  text,
  nodeKey,
}: {
  text: string;
  nodeKey: string;
}) {
  const { isSelected, select, isPseudoSelected } = useIsSelected(nodeKey);

  const symbol = text;

  if (symbol === ",") {
    return (
      <div
        className={cl("selection-box cursor-text", isSelected && "bg-gray-700")}
      >
        <span
          className={cl(
            "relative w-2 flex-center opacity-50", // selection:bg-transparent
            // isSelected && "ring-2 ring-amber-300",
            isPseudoSelected && caretClasses
          )}
          onMouseDown={() => select()}
        >
          ,
        </span>
      </div>
    );
  }

  if (["(", "[", ")", "]"].includes(symbol)) {
    const open = (
      <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
        <path
          d="M4,0 A 10 10 0 0 0 4 16 A 20 20 0 0 1 4 0"
          className={cl(symbol === "[" ? "fill-amber-500" : "fill-gray-500")}
        />
      </svg>
    );

    const close = (
      <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
        <path
          d="M0,0 A 10 10 0 0 1 0 16 A 20 20 0 0 0 0 0"
          className={cl(symbol === "]" ? "fill-amber-500" : "fill-gray-500")}
        />
      </svg>
    );

    return (
      <div
        className={cl("selection-box cursor-text", isSelected && "bg-gray-700")}
      >
        <span
          className={cl(
            "relative w-[6px] h-6 flex-center selection:bg-transparent text-xs text-gray-800",
            isPseudoSelected && caretClasses
          )}
          onMouseDown={() => select()}
        >
          {["(", "["].includes(symbol) ? open : close}
        </span>
      </div>
    );
  }

  const transform: Record<string, string> = {
    "*": "×",
    "/": "÷",
  };

  const colors = () => {
    if (symbol === "?" || symbol === ":") {
      return cl(
        "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
        !isSelected && "ring-1 ring-green-200 dark:ring-green-700"
      );
    }
    return cl(
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-sky-100",
      "ring-1 ring-gray-200 dark:ring-gray-700"
    );
  };

  return (
    <div
      className={cl("selection-box cursor-text", isSelected && "bg-gray-700")}
    >
      <span
        className={cl(
          colors(),
          "relative w-4 h-4 my-1 pb-0.5 flex-center rounded-full text-xs leading-none selection:bg-transparent",
          // isSelected && "ring-2 ring-amber-300",
          isPseudoSelected && caretClasses
        )}
        onMouseDown={() => select()}
      >
        {transform[symbol] ?? symbol}
      </span>
    </div>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  const textContent = domNode.textContent;

  if (textContent !== null) {
    const node = $createOperatorNode(textContent);
    return {
      node,
    };
  }

  return null;
}

export type SerializedOperatorNode = Spread<
  {
    type: "operator";
    text: string;
  },
  SerializedLexicalNode
>;

export class OperatorNode extends DecoratorNode<React.ReactNode> {
  __text: string;

  static getType(): string {
    return "operator";
  }

  static clone(node: OperatorNode): OperatorNode {
    return new OperatorNode(node.__text, node.__key);
  }

  constructor(text: string, key?: NodeKey) {
    super(key);
    this.__text = text;
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
    serializedOperatorNode: SerializedOperatorNode
  ): OperatorNode {
    return $createOperatorNode(serializedOperatorNode.text);
  }

  exportJSON(): SerializedOperatorNode {
    return {
      type: "operator",
      text: this.getTextContent(),
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-operator", "true");
    element.textContent = this.__text;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-operator")) {
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
    return <OperatorDecorator text={this.__text} nodeKey={this.__key} />;
  }
}

export function $createOperatorNode(text: string): OperatorNode {
  return new OperatorNode(text);
}

export function $isOperatorNode(node: LexicalNode): boolean {
  return node instanceof OperatorNode;
}
