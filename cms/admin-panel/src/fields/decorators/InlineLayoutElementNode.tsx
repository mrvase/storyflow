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
import { LayoutElement, Value } from "@storyflow/backend/types";
import { ParentPropContext } from "../default/DefaultField";
import { stringifyPath, useBuilderPath } from "../BuilderPath";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { useGlobalState } from "../../state/state";
import { useFieldId } from "../FieldIdContext";

function InlineLayoutElementDecorator({
  value,
  nodeKey,
}: {
  value: LayoutElement;
  nodeKey: string;
}) {
  const [path, setPath] = useBuilderPath();
  const parentProp = React.useContext(ParentPropContext);

  const pathString = stringifyPath(path);

  const id = useFieldId();

  const parentPath = pathString ? `${pathString}/${parentProp?.name}` : "";
  const pathToLabel = `${id}${parentPath ? "." : ""}${parentPath}.${
    value.id
  }/label`;

  const [output] = useGlobalState<Value[]>(pathToLabel);

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.type, libraries);

  const text =
    typeof output?.[0] === "string" ? output[0] : config?.label ?? value.type;

  return (
    <span
      className={cl(
        "text-gray-100/90 rounded-sm selection:bg-transparent relative",
        "before:absolute before:-z-10 before:inset-0 before:rounded-t-sm before:bg-gray-50 before:dark:bg-gray-400/20 ",
        "after:absolute after:-z-10 after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-green-300/50 after:rounded-b-sm",
        isSelected ? "ring-2 ring-amber-300" : "dark:ring-gray-600",
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
          setPath((ps) => [
            ...ps,
            {
              id: value.id,
              label: config?.label ?? value.type,
              parentProp: parentProp,
            },
          ]);
        }
        selectClick.current = false;
      }}
    >
      {text}
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
    element.setAttribute("data-lexical-inline", "true");
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
    element.setAttribute("data-lexical-inline", "true");
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
