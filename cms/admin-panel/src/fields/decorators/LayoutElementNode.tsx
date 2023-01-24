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
import { useClientConfig } from "../../client-config";

function LayoutElementDecorator({
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

  const component = useClientConfig().components[value.type];

  return (
    <div className="py-0.5">
      <div
        className={cl(
          "relative bg-fuchsia-100 text-fuchsia-800 dark:bg-gray-800 dark:text-gray-200",
          "flex rounded px-2 text-sm selection:bg-transparent",
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
              label: component.label ?? value.type,
              // type: value.type,
              parentProp: parentProp,
            });
          }
          selectClick.current = false;
        }}
      >
        {component.label ?? value.type}
        {/*<button className="group h-full px-2 hover:bg-white/5 flex-center gap-1 rounded cursor-default transition-colors">
          {component.label ?? value.type}{" "}
          <ChevronDownIcon className="w-3 h-3 opacity-0 group-hover:opacity-75 transition-opacity" />
      </button>*/}
      </div>
    </div>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedLayoutElementNode = Spread<
  {
    type: "layout-element";
    value: LayoutElement;
  },
  SerializedLexicalNode
>;

export class LayoutElementNode extends DecoratorNode<React.ReactNode> {
  __value: LayoutElement;

  static getType(): string {
    return "layout-element";
  }

  static clone(node: LayoutElementNode): LayoutElementNode {
    return new LayoutElementNode(node.__value, node.__key);
  }

  constructor(value: LayoutElement, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-layout-element", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return `%`;
  }

  static importJSON(
    serializedLayoutElementNode: SerializedLayoutElementNode
  ): LayoutElementNode {
    return $createLayoutElementNode(serializedLayoutElementNode.value);
  }

  exportJSON(): SerializedLayoutElementNode {
    const self = this.getLatest();
    return {
      type: "layout-element",
      value: self.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-layout-element", "true");
    element.textContent = `%`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-layout-element")) {
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
    return <LayoutElementDecorator value={this.__value} nodeKey={this.__key} />;
  }
}

export function $createLayoutElementNode(
  element: LayoutElement
): LayoutElementNode {
  return new LayoutElementNode(element);
}

export function $isLayoutElementNode(node: LexicalNode): boolean {
  return node instanceof LayoutElementNode;
}