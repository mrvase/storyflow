import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import type { FunctionSymbol } from "@storyflow/fields-core/types";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

function Decorator({
  value,
  nodeKey,
}: {
  value: FunctionSymbol;
  nodeKey: string;
}) {
  const func = Object.keys(value)[0];

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const open = (
    <svg viewBox="0 0 4 16" width={6} height={24} className="absolute">
      <path
        d="M4,0 A 10 10 0 0 0 4 16 A 20 20 0 0 1 4 0"
        className={cl("fill-amber-500")}
      />
    </svg>
  );

  const label = "";

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

const type = "function";
type TokenType = FunctionSymbol;

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

export function $createFunctionNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isFunctionNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
