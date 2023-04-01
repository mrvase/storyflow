import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import { Parameter } from "@storyflow/backend/types";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

function Decorator({ value, nodeKey }: { value: Parameter; nodeKey: string }) {
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
        {value.x ?? "x"}
      </span>
    </div>
  );
}
const type = "parameter";
type TokenType = Parameter;

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

export function $createParameterNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isParameterNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
