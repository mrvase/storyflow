import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { Operator } from "@storyflow/backend/types";

function Decorator({ nodeKey }: { value: { ",": true }; nodeKey: string }) {
  const { isSelected, select, isPseudoSelected } = useIsSelected(nodeKey);

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

const type = "comma";
type TokenType = { ",": true };

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

export function $createCommaNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isCommaNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
