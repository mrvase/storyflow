import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import cl from "clsx";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { useGlobalContext } from "../../../state/context";
import { useDocumentPageContext } from "../../../documents/DocumentPageContext";
import { getPreview } from "../../default/getPreview";
import type { ContextToken, ValueArray } from "@storyflow/shared/types";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

const useState = (ctx: string): ValueArray | undefined => {
  const { id: documentId } = useDocumentPageContext();
  const [value] = useGlobalContext(documentId, ctx);
  return [value[ctx]];
};

function Decorator({
  nodeKey,
  value: { ctx },
}: {
  nodeKey: string;
  value: ContextToken;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const value = useState(ctx);

  const preview = getPreview(value ?? []);

  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "rounded-sm selection:bg-transparent relative",
        "bg-fuchsia-100 dark:bg-fuchsia-400/20 text-fuchsia-700/90 dark:text-fuchsia-100/90",
        // "after:absolute after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-white/20",
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
      {isSelected && (
        <span
          className={cl(
            "relative text-gray-600 dark:text-fuchsia-400 truncate select-none",
            preview && "ml-1 mr-2"
          )}
        >
          {ctx}
        </span>
      )}
      <span className="select-none">{preview || "Intet indhold"}</span>
    </span>
  );
}

const type = "context";
type TokenType = ContextToken;

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

export function $createContextNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isContextNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
