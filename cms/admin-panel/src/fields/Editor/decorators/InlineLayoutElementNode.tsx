import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import type { NestedElement, ValueArray } from "@storyflow/shared/types";
import { getConfigFromType, useAppConfig } from "../../../AppConfigContext";
import { useGlobalState } from "../../../state/state";
import { computeFieldId, getIdFromString } from "@storyflow/cms/ids";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { usePath, useSelectedPath } from "../../Path";
import { LayoutElement } from "./LayoutElementNode";
import useIsFocused from "../../../utils/useIsFocused";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedElement;
  nodeKey: string;
}) {
  const { isFocused, handlers } = useIsFocused();

  const pathToLabel = computeFieldId(value.id, getIdFromString("label"));

  const [output] = useGlobalState<ValueArray>(pathToLabel);

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const { configs } = useAppConfig();
  const config = getConfigFromType(value.element, configs);

  const text =
    typeof output?.[0] === "string"
      ? output[0]
      : config?.label ?? value.element;

  return (
    <span
      {...handlers}
      className={cl(
        "rounded-sm bg-gray-100 dark:bg-gray-400/20",
        "after:absolute after:-z-10 after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-green-300/50 after:rounded-b-sm",
        isSelected
          ? "ring-1 ring-gray-800 dark:ring-gray-200"
          : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={(ev) => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
        handlers.onMouseDown(ev);
      }}
      onClick={() => {
        /*
        if (isSelected && !selectClick.current) {
          setPath((ps) => [...selectedPath, ...path, value.id]);
        }
        selectClick.current = false;
        */
      }}
    >
      <span className="selection:bg-transparent">{text}</span>
      {isFocused && (
        <div className="w-[calc(100%-0.5rem)] bg-white dark:bg-gray-900 absolute z-50 left-0 m-1 p-1.5 rounded">
          <LayoutElement value={value} nodeKey={nodeKey} />
        </div>
      )}
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
