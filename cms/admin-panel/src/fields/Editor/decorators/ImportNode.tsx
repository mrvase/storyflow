import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import cl from "clsx";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { useLabel } from "../../../documents/collab/hooks";
import { useGlobalState } from "../../../state/state";
import { getPreview } from "../../default/getPreview";
import type { ValueArray } from "@storyflow/shared/types";
import type { NestedField } from "@storyflow/fields-core/types";
import type { HasSelect } from "operations/types";
import { revertTemplateFieldId } from "@storyflow/fields-core/ids";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

const useState = (
  field: HasSelect<NestedField>
): [label: string, value: ValueArray | undefined] => {
  if (field.select && field.loop) {
    const label2 = useLabel(revertTemplateFieldId(field.select));
    return ["", [label2 || "?"]];
  }
  if (field.select) {
    const label1 = useLabel(field.field);
    const label2 = useLabel(revertTemplateFieldId(field.select));
    return ["", [`${label1} · ${label2 || "?"}`]];
  }

  const value = useGlobalState<ValueArray>(field.field)[0];
  const label = useLabel(field.field);
  return [label, value];
};

function Decorator({
  nodeKey,
  value: fieldImport,
}: {
  nodeKey: string;
  value: HasSelect<NestedField>;
}) {
  // const [, setPath] = useBuilderPath();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const parameters = ["x", "y", "z"];

  const isColumn = Boolean(fieldImport.select);
  const isLoop = Boolean(fieldImport.loop);

  const [label, value] = useState(fieldImport);

  const preview = getPreview(value ?? []);

  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "rounded selection:bg-transparent relative ring-1 ring-inset",
        isLoop
          ? "bg-red-100 dark:bg-red-400/20 text-red-700/90 dark:text-red-100/90 text-sm py-0.5 px-1.5 font-medium"
          : isColumn
          ? "bg-sky-100 dark:bg-sky-400/20 text-sky-700/90 dark:text-sky-100/90 text-sm py-0.5 px-1.5 font-medium"
          : "bg-teal-100 dark:bg-teal-400/20 text-teal-700/90 dark:text-teal-100/90",
        // "after:absolute after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-white/20",
        isSelected
          ? "ring-white"
          : isLoop
          ? "ring-red-400/20"
          : isColumn
          ? "ring-sky-400/20"
          : "ring-transparent",
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
          /*
          setPath((ps) => [
            ...ps,
            {
              id: fieldImport.id,
              label: fieldImport.id,
            },
          ]);
          */
        }
        selectClick.current = false;
      }}
    >
      {label && isSelected && (
        <span
          className={cl(
            "relative text-gray-600 dark:text-teal-400 truncate select-none py-0.5 text-sm font-medium",
            preview && "mx-2"
          )}
        >
          {label}
        </span>
      )}
      {Array.isArray(preview) ? (
        <>
          {preview.map((el) => (
            <span
              key={el}
              className="bg-fuchsia-200 text-fuchsia-800 w-4 h-4 text-xs flex-center rounded-full"
            >
              {parameters[el] ?? "."}
            </span>
          ))}
        </>
      ) : (
        <span className="select-none">{preview || "Intet indhold"}</span>
      )}
    </span>
  );
}

const type = "nested-field";
type TokenType = HasSelect<NestedField>;

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

export function $createImportNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isImportNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
