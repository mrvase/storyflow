import cl from "clsx";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { FileToken } from "@storyflow/backend/types";
import { LexicalNode, NodeKey } from "lexical";
import React from "react";
import { useFileLabel } from "../../files";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { useIsSelected } from "./useIsSelected";

function Decorator({ nodeKey, value }: { nodeKey: string; value: FileToken }) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const label = useFileLabel(value.src);

  return (
    <span
      className={cl(
        "bg-gray-50 dark:bg-sky-400/20 text-sky-100/90 rounded-sm selection:bg-transparent relative px-2",
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
      <span className="flex-center gap-2">
        <PhotoIcon className="w-4 h-4 inline" />
        {label}
      </span>
    </span>
  );
}

const type = "file-token";
type TokenType = FileToken;

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

export function $createFileNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isFileNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
