import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import type {
  DateToken,
  NestedElement,
  ValueArray,
} from "@storyflow/shared/types";
import { getConfigFromType, useAppConfig } from "../../../AppConfigContext";
import { useGlobalState } from "../../../state/state";
import { computeFieldId, getIdFromString } from "@storyflow/cms/ids";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { usePath, useSelectedPath } from "../../Path";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { serializeDate } from "../../../data/dates";

function Decorator({ nodeKey, value }: { nodeKey: string; value: DateToken }) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const date = new Date(value.date);

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
        <CalendarDaysIcon className="w-4 h-4 inline" />
        {Intl.DateTimeFormat("da-DK", {
          weekday: "long",
        })
          .format(date)
          .slice(0, 3)}{" "}
        {serializeDate(date)}
      </span>
    </div>
  );
}

const type = "date";
type TokenType = DateToken;

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

export function $createDateNode(value: DateToken): ChildNode {
  return new ChildNode(value);
}

export function $isDateNode(node: LexicalNode): node is ChildNode {
  return node instanceof ChildNode;
}
