import cl from "clsx";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { FileToken } from "@storyflow/backend/types";
import { LexicalNode, NodeKey } from "lexical";
import React from "react";
import { useFileLabel } from "../../../data/files";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { useIsSelected } from "./useIsSelected";
import { useUrlInfo } from "../../../users";

function Decorator({ nodeKey, value }: { nodeKey: string; value: FileToken }) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const label = useFileLabel(value.src);

  return (
    <div
      className={cl(
        "bg-gradient-to-b from-gray-800/90 to-gray-800/90 text-gray-200",
        "rounded relative ring-1",
        "flex gap-2 items-center",
        isSelected ? "ring-white" : "dark:ring-gray-700"
        // isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <Image src={value.src} />
      <div>{label}</div>
    </div>
  );
}

function Image({ src }: { src: string }) {
  const { organization } = useUrlInfo();
  return (
    <div className="flex-center h-10 w-10 rounded overflow-hidden bg-white/5">
      <img
        src={`https://cdn.storyflow.dk/${organization}/${src}`}
        className="max-w-full max-h-full w-auto h-auto"
        loading="lazy"
      />
    </div>
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
