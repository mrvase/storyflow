import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import { NestedElement, ValueArray } from "@storyflow/backend/types";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { useGlobalState } from "../../state/state";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { usePath, useSelectedPath } from "../Path";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedElement;
  nodeKey: string;
}) {
  const path = usePath();
  const [{ selectedPath, selectedDocument }, setPath] = useSelectedPath();

  const pathToLabel = computeFieldId(value.id, getIdFromString("label"));

  const [output] = useGlobalState<ValueArray>(pathToLabel);

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.element, libraries);

  const text =
    typeof output?.[0] === "string"
      ? output[0]
      : config?.label ?? value.element;

  return (
    <span
      className={cl(
        "text-gray-100/90 rounded-sm selection:bg-transparent relative z-0",
        "before:absolute before:-z-10 before:inset-0 before:rounded-t-sm before:bg-gray-50 before:dark:bg-gray-400/20 ",
        "after:absolute after:-z-10 after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-green-300/50 after:rounded-b-sm",
        isSelected ? "ring-1 ring-amber-300" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
      onClick={() => {
        if (isSelected && !selectClick.current) {
          setPath((ps) => [...selectedPath, ...path, value.id]);
        }
        selectClick.current = false;
      }}
    >
      {text}
    </span>
  );
}

const type = "inline-layout-element";
type TokenType = NestedElement & { inline: true };

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

export function $createInlineLayoutElementNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isInlineLayoutElementNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
