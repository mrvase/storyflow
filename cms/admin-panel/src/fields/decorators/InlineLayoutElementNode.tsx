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
import { LayoutElement } from "@storyflow/backend/types";
import { ParentPropContext } from "../DefaultField";
import { usePathContext } from "../FieldContainer";
import { getConfigFromType, useClientConfig } from "../../client-config";

function InlineLayoutElementDecorator({
  value,
  nodeKey,
}: {
  value: LayoutElement;
  nodeKey: string;
}) {
  const { goToPath } = usePathContext();
  const parentProp = React.useContext(ParentPropContext);

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.type, libraries);

  return (
    <span
      className={cl(
        "relative my-0.5 px-2 bg-fuchsia-100 text-fuchsia-800 dark:bg-gray-800 dark:text-gray-200 flex",
        "flex rounded text-sm selection:bg-transparent",
        isSelected && "ring-2 ring-amber-300",
        !isSelected && "ring-1 ring-gray-200 dark:ring-gray-700",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
      onClick={() => {
        if (isSelected && !selectClick.current) {
          goToPath({
            id: value.id,
            label: config?.label ?? value.type,
            parentProp: parentProp,
          });
        }
        selectClick.current = false;
      }}
    >
      {config?.label ?? value.type}
    </span>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedInlineLayoutElementNode = Spread<
  {
    type: "inline-layout-element";
    value: LayoutElement;
  },
  SerializedLexicalNode
>;

export class InlineLayoutElementNode extends DecoratorNode<React.ReactNode> {
  __value: LayoutElement;

  static getType(): string {
    return "inline-layout-element";
  }

  static clone(node: InlineLayoutElementNode): InlineLayoutElementNode {
    return new InlineLayoutElementNode(node.__value, node.__key);
  }

  constructor(value: LayoutElement, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-inline-layout-element", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return `%`;
  }

  static importJSON(
    serializedLayoutElementNode: SerializedInlineLayoutElementNode
  ): InlineLayoutElementNode {
    return $createInlineLayoutElementNode(serializedLayoutElementNode.value);
  }

  exportJSON(): SerializedInlineLayoutElementNode {
    const self = this.getLatest();
    return {
      type: "inline-layout-element",
      value: self.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-inline-layout-element", "true");
    element.textContent = `%`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-inline-layout-element")) {
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
    return (
      <InlineLayoutElementDecorator value={this.__value} nodeKey={this.__key} />
    );
  }
}

export function $createInlineLayoutElementNode(
  element: LayoutElement
): InlineLayoutElementNode {
  return new InlineLayoutElementNode(element);
}

export function $isInlineLayoutElementNode(node: LexicalNode): boolean {
  return node instanceof InlineLayoutElementNode;
}
