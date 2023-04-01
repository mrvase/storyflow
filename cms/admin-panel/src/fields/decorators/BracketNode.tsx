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
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { Operator } from "@storyflow/backend/types";

function Decorator({ value, nodeKey }: { value: TokenType; nodeKey: string }) {
  const { isSelected, select, isPseudoSelected } = useIsSelected(nodeKey);

  const key = Object.keys(value)[0] as "(" | ")" | "[" | "]";

  const open = (
    <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
      <path
        d="M4,0 A 10 10 0 0 0 4 16 A 20 20 0 0 1 4 0"
        className={cl(key === "[" ? "fill-amber-500" : "fill-gray-500")}
      />
    </svg>
  );

  const close = (
    <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
      <path
        d="M0,0 A 10 10 0 0 1 0 16 A 20 20 0 0 0 0 0"
        className={cl(key === "]" ? "fill-amber-500" : "fill-gray-500")}
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
        {["(", "["].includes(key) ? open : close}
      </span>
    </div>
  );
}

const type = "bracket";
type TokenType =
  | { ["("]: true }
  | { [")"]: true }
  | { ["["]: true }
  | { ["]"]: true };

export default class ChildNode extends TokenStreamNode<typeof type, TokenType> {
  static getType(): string {
    return type;
  }

  static clone(node: ChildNode): ChildNode {
    return new ChildNode(node.__token, node.__key);
  }

  constructor(token: TokenType, key?: NodeKey) {
    super(type, token, key);
  }

  isInline(): true {
    return true;
  }

  exportJSON(): SerializedTokenStreamNode<typeof type, TokenType> {
    return super.exportJSON();
  }

  static importJSON(
    serializedNode: SerializedTokenStreamNode<typeof type, TokenType>
  ) {
    return new ChildNode(serializedNode.token);
  }

  decorate(): React.ReactNode {
    return <Decorator nodeKey={this.__key} value={this.__token} />;
  }
}

export function $createBracketNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isBracketNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
