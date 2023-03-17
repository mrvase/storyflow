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
import cl from "clsx";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { useGlobalContext } from "../../state/context";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { getPreview } from "../default/getPreview";
import { ContextToken, ValueArray } from "@storyflow/backend/types";

const useState = (ctx: string): ValueArray | undefined => {
  const { id: documentId } = useDocumentPageContext();
  const [value] = useGlobalContext(documentId, ctx);
  return [value[ctx]];
};

function ContextDecorator({
  nodeKey,
  value: { ctx },
}: {
  text: string;
  nodeKey: string;
  value: ContextToken;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const value = useState(ctx);

  const preview = getPreview(value ?? []);

  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "rounded-sm selection:bg-transparent relative",
        "bg-fuchsia-100 dark:bg-fuchsia-400/20 text-fuchsia-700/90 dark:text-fuchsia-100/90",
        // "after:absolute after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-white/20",
        isSelected ? "ring-1 ring-amber-300" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      {isSelected && (
        <span
          className={cl(
            "relative text-gray-600 dark:text-fuchsia-400 truncate select-none",
            preview && "ml-1 mr-2"
          )}
        >
          {ctx}
        </span>
      )}
      <span className="select-none">{preview || "Intet indhold"}</span>
    </span>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedContextNode = Spread<
  {
    type: "context";
    value: ContextToken;
  },
  SerializedLexicalNode
>;

export class ContextNode extends DecoratorNode<React.ReactNode> {
  __value: ContextToken;

  static getType(): string {
    return "context";
  }

  static clone(node: ContextNode): ContextNode {
    return new ContextNode(node.__value, node.__key);
  }

  constructor(value: ContextToken, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-import", "true");
    element.setAttribute("data-lexical-inline", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return "x";
  }

  static importJSON(serializedContextNode: SerializedContextNode): ContextNode {
    return $createContextNode(serializedContextNode.value);
  }

  exportJSON(): SerializedContextNode {
    return {
      type: "context",
      value: this.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-import", "true");
    element.setAttribute("data-lexical-inline", "true");
    element.textContent = "x";
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-import")) {
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
      <ContextDecorator
        text={this.__text}
        nodeKey={this.__key}
        value={this.__value}
      />
    );
  }
}

export function $createContextNode(value: ContextToken): ContextNode {
  return new ContextNode(value);
}

export function $isContextNode(node: LexicalNode): boolean {
  return node instanceof ContextNode;
}
