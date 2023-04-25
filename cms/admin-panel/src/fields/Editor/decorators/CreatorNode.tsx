import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import type { FieldId } from "@storyflow/shared/types";
import type { NestedCreator } from "@storyflow/fields-core/types";
import { DefaultField } from "../../default/DefaultField";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedCreator;
  nodeKey: string;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const [props, setProps] = React.useState<{}[]>([]);

  const g = () => Math.random().toString(16).slice(2, 10);

  const id = React.useMemo(() => `${g()}${g()}${g()}` as FieldId, []);

  return (
    <div className="py-0.5">
      <div
        className={cl(
          "flex flex-col gap-2 gradient-border",
          "relative z-0 py-2.5",
          "rounded selection:bg-transparent",
          isSelected && "selected"
        )}
        onMouseDown={() => {
          if (!isSelected) {
            select();
          }
        }}
      >
        <DefaultField id={id} />
        {/*<input
          type="text"
          className="px-1 w-full bg-transparent outline-none"
        />
        <div className="rounded ring-1 dark:ring-red-500 divide-y divide-red-500 dark:text-gray-200">
          {props.map((el) => (
            <div className="p-2">
              <div className="text-sm font-medium">Her er en egenskab</div>
              <div className="pt-1">Her skriver jeg</div>
            </div>
          ))}
          <div
            className="text-xs py-0.5 px-2"
            onClick={() => setProps((ps) => [...ps, {}])}
          >
            Tilføj egenskab
          </div>
          </div>*/}
      </div>
    </div>
  );
}

const type = "creator";
type TokenType = NestedCreator;

type NewType = SerializedTokenStreamNode<typeof type, TokenType>;

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

  static importJSON(serializedNode: NewType) {
    return new ChildNode(serializedNode.token);
  }

  decorate(): React.ReactNode {
    return <Decorator nodeKey={this.__key} value={this.__token} />;
  }
}

export function $createCreatorNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isCreatorNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
