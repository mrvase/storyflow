import cl from "clsx";
import { SwatchIcon } from "@heroicons/react/24/outline";
import type { ColorToken, Option } from "@storyflow/shared/types";
import { LexicalNode, NodeKey } from "lexical";
import React from "react";
import { colors, getColorName } from "../../../data/colors";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { useIsSelected } from "./useIsSelected";
import useSWRImmutable from "swr/immutable";

function Decorator({
  nodeKey,
  value,
}: {
  nodeKey: string;
  value: ColorToken | Option;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const { data } = useSWRImmutable("colors", () => colors);

  let label: string | undefined;
  let color: string;

  if (!("color" in value)) {
    label = "label" in value ? value.label : value.alias;
    color = "value" in value ? (value.value! as string) : "#ffffff";
  } else {
    color = value.color;
    label = data
      ? getColorName(color.slice(1), data[0], data[1]).split(" / ")[0]
      : "";
  }

  return (
    <div
      className={cl(
        "bg-sky-100 dark:bg-sky-400/20 rounded-sm selection:bg-transparent relative px-2",
        isSelected && "ring-1 ring-gray-900 dark:ring-white",
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
        <SwatchIcon className="w-4 h-4 inline" />
        {label}
        <div
          className="w-4 h-4 rounded ring-1 ring-inset ring-white/50"
          style={{ backgroundColor: color }}
        />
      </span>
    </div>
  );
}

export const ColorDecorator = Decorator;

const type = "color-token";
type TokenType = ColorToken;

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

export function $createColorNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isColorNode(node: LexicalNode): node is ChildNode {
  return node instanceof ChildNode;
}
