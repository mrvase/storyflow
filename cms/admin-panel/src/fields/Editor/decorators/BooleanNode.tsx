import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { CalendarDaysIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useEditorContext } from "../../../editor/react/EditorProvider";

function Decorator({
  nodeKey,
  value,
  setToken,
}: {
  nodeKey: string;
  value: boolean;
  setToken: (value: boolean) => void;
}) {
  const editor = useEditorContext();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

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
        <div
          className="w-4 h-4 rounded-sm bg-white dark:bg-gray-800"
          onClick={() => {
            editor.update(() => {
              setToken(!value);
            });
          }}
        >
          {value ? <CheckIcon className="w-4 h-4" /> : null}
        </div>
        {value ? "Ja" : "Nej"}
      </span>
    </div>
  );
}

const type = "boolean";
type TokenType = boolean;

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
    return (
      <Decorator
        nodeKey={this.__key}
        value={this.__token}
        setToken={(value) => this.setToken(value)}
      />
    );
  }
}

export function $createBooleanNode(value: boolean): ChildNode {
  return new ChildNode(value);
}

export function $isBooleanNode(node: LexicalNode): node is ChildNode {
  return node instanceof ChildNode;
}
