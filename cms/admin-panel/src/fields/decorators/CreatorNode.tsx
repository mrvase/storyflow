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
import { FieldId, NestedCreator } from "@storyflow/backend/types";
import { WritableDefaultField } from "../default/RenderNestedFields";

function CreatorDecorator({
  value,
  nodeKey,
}: {
  value: NestedCreator;
  nodeKey: string;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const [props, setProps] = React.useState<{}[]>([]);

  const g = () => Math.random().toString(16).slice(2, 10);

  const id = React.useMemo(() => `${g()}${g()}${g()}` as FieldId, []);

  return (
    <div className="py-0.5">
      <div
        className={cl(
          "flex flex-col gap-2 gradient-border",
          "relative z-0 text-white cursor-default p-2",
          "rounded text-sm selection:bg-transparent",
          isSelected && "ring-1 ring-amber-300",
          isPseudoSelected && caretClasses
        )}
        onMouseDown={() => {
          if (!isSelected) {
            select();
          }
        }}
      >
        <WritableDefaultField
          id={id}
          initialValue={{
            type: "root",
            children: [],
          }}
          fieldConfig={{
            type: "default",
          }}
        />
        {/*<input
          type="text"
          className="px-1 w-full bg-transparent outline-none"
        />
        <div className="rounded ring-1 dark:ring-red-500 divide-y divide-red-500 dark:text-gray-200">
          {props.map((el) => (
            <div className="p-2">
              <div className="text-sm font-medium">Her er en egenskab</div>
              <div className="pt-1">Her skriver jeg</div>
            </div>
          ))}
          <div
            className="text-xs py-0.5 px-2"
            onClick={() => setProps((ps) => [...ps, {}])}
          >
            Tilføj egenskab
          </div>
          </div>*/}
      </div>
    </div>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedCreatorNode = Spread<
  {
    type: "creator-element";
    value: NestedCreator;
  },
  SerializedLexicalNode
>;

export class CreatorNode extends DecoratorNode<React.ReactNode> {
  __value: NestedCreator;

  static getType(): string {
    return "creator-element";
  }

  static clone(node: CreatorNode): CreatorNode {
    return new CreatorNode(node.__value, node.__key);
  }

  constructor(value: NestedCreator, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-creator-element", "true");
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

  static importJSON(serializedCreatorNode: SerializedCreatorNode): CreatorNode {
    return $createCreatorNode(serializedCreatorNode.value);
  }

  exportJSON(): SerializedCreatorNode {
    const self = this.getLatest();
    return {
      type: "creator-element",
      value: self.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-creator-element", "true");
    element.textContent = `%`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-creator-element")) {
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
    return <CreatorDecorator value={this.__value} nodeKey={this.__key} />;
  }
}

export function $createCreatorNode(element: NestedCreator): CreatorNode {
  return new CreatorNode(element);
}

export function $isCreatorNode(node: LexicalNode): node is CreatorNode {
  return node instanceof CreatorNode;
}
