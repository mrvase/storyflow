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

function ParameterDecorator({
  label,
  nodeKey,
}: {
  label: string;
  nodeKey: string;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  return (
    <div
      className={cl("selection-box cursor-text", isSelected && "bg-gray-700")}
    >
      <span
        className={cl(
          "relative bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-800 dark:text-fuchsia-200 font-serif",
          "w-4 h-4 my-1 flex-center rounded-full  text-sm pb-[2px] selection:bg-transparent",
          //isSelected && "ring-2 ring-amber-300",
          "ring-1 ring-fuchsia-200 dark:ring-fuchsia-700",
          isPseudoSelected && caretClasses
        )}
        onMouseDown={() => select()}
      >
        {label ?? "x"}
      </span>
    </div>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  const textContent = domNode.textContent;

  if (textContent !== null) {
    const node = $createParameterNode(textContent);
    return {
      node,
    };
  }

  return null;
}

export type SerializedParameterNode = Spread<
  {
    type: "parameter";
    text: string;
  },
  SerializedLexicalNode
>;

export class ParameterNode extends DecoratorNode<React.ReactNode> {
  __text: string;

  static getType(): string {
    return "parameter";
  }

  static clone(node: ParameterNode): ParameterNode {
    return new ParameterNode(node.__text, node.__key);
  }

  constructor(label: string, key?: NodeKey) {
    super(key);
    this.__text = label;
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
    return `${self.__text}`;
  }

  static importJSON(
    serializedParameterNode: SerializedParameterNode
  ): ParameterNode {
    return $createParameterNode(serializedParameterNode.text);
  }

  exportJSON(): SerializedParameterNode {
    const self = this.getLatest();
    return {
      type: "parameter",
      text: self.__text,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-parameter", "true");
    element.textContent = `${this.__text}`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-parameter")) {
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
    return <ParameterDecorator label={this.__text} nodeKey={this.__key} />;
  }
}

export function $createParameterNode(label: string): ParameterNode {
  return new ParameterNode(label);
}

export function $isParameterNode(node: LexicalNode): boolean {
  return node instanceof ParameterNode;
}
