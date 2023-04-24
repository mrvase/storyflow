import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import cl from "clsx";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { useLabel } from "../../../documents/collab/hooks";
import { revertTemplateFieldId } from "@storyflow/backend/ids";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

/*
function Decorator({ nodeKey, value }: { nodeKey: string; value: LoopToken }) {
  // const [, setPath] = useBuilderPath();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const label = useLabel(revertTemplateFieldId(value.loop));

  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "rounded selection:bg-transparent relative text-sm py-0.5 px-1.5 ring-1 ring-inset",
        "bg-red-100 dark:bg-red-400/20 text-red-700/90 dark:text-red-100/90 font-medium",
        // "after:absolute after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-white/20",
        isSelected ? "ring-white" : "dark:ring-red-400/20",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <span className="select-none">{label || "Ingen label"}</span>
    </span>
  );
}

const type = "loop";
type TokenType = LoopToken;

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

export function $createLoopNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isLoopNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
*/
