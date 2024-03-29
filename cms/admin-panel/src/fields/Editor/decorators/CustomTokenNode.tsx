import React from "react";
import cl from "clsx";
import type { CustomToken } from "@storyflow/shared/types";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { TagIcon } from "@heroicons/react/24/outline";
import type { Option } from "@storyflow/shared/types";
import { useFieldRestriction, useFieldOptions } from "../../FieldIdContext";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { LexicalNode, NodeKey } from "lexical";
import { ColorDecorator } from "./ColorNode";

function Decorator({
  nodeKey,
  value,
}: {
  nodeKey: string;
  value: CustomToken;
}) {
  const restrictTo = useFieldRestriction();

  const options = useFieldOptions();
  const option = (options as Option[]).find(
    (option) => typeof option === "object" && option.alias === value.name
  );

  if (restrictTo === "color" && option) {
    return <ColorDecorator nodeKey={nodeKey} value={option} />;
  }

  return <CustomDecorator nodeKey={nodeKey} value={value} />;
}

function CustomDecorator({
  nodeKey,
  value,
}: {
  nodeKey: string;
  value: CustomToken;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const options = useFieldOptions();

  const option = (options as Option[]).find(
    (option) => typeof option === "object" && option.alias === value.name
  );

  let label = option && "label" in option ? option.label : value.name;

  return (
    <div
      className={cl(
        "bg-gray-50 dark:bg-sky-400/20 text-sky-100/90 rounded-sm selection:bg-transparent relative px-2",
        isSelected ? "ring-1 ring-white" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <span className="flex items-center gap-2">
        <TagIcon className="w-4 h-4 inline" />
        {label}
      </span>
    </div>
  );
}

const type = "custom-token";
type TokenType = CustomToken;

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

export function $createCustomTokenNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isCustomTokenNode(node: LexicalNode): node is ChildNode {
  return node instanceof ChildNode;
}
