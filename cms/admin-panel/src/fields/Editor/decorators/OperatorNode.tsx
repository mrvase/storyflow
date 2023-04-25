import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { Operator } from "@storyflow/shared/types";

function Decorator({
  value,
  nodeKey,
}: {
  value: { _: Operator };
  nodeKey: string;
}) {
  const { isSelected, select, isPseudoSelected } = useIsSelected(nodeKey);

  const symbol = value["_"];

  const transform: Record<string, string> = {
    "*": "×",
    "/": "÷",
  };

  const colors = () => {
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

const type = "operator";
type TokenType = { _: Operator };

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

export function $createOperatorNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isOperatorNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
