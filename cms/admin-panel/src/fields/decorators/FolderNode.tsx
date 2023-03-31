import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import {
  SyntaxTreeRecord,
  NestedDocument,
  NestedFolder,
} from "@storyflow/backend/types";
import { FolderIcon } from "@heroicons/react/24/outline";
import { useFieldId } from "../FieldIdContext";
import { useFieldTemplate } from "../default/useFieldTemplate";
import { useFolder } from "../../folders/collab/hooks";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedFolder;
  nodeKey: string;
}) {
  // const [, setPath] = useBuilderPath();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const id = useFieldId();
  const template = useFieldTemplate(id);
  const hasTemplate = Boolean(template);

  const color = cl(
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    !isSelected && "ring-1 ring-red-200 dark:ring-red-800",
    hasTemplate &&
      "child:divide-x child:divide-red-200 child:dark:divide-red-800"
  );

  let docs: (NestedDocument & { record: SyntaxTreeRecord })[] = [];

  const folder = useFolder(value.folder);

  return (
    <div className="py-0.5">
      <div
        className={cl(
          "relative",
          "rounded text-sm selection:bg-transparent",
          isSelected && "ring-1 ring-amber-300",
          color,
          isPseudoSelected && caretClasses
        )}
        onMouseDown={() => {
          if (!isSelected) {
            select();
            selectClick.current = true;
          }
        }}
        onClick={() => {
          if (
            isSelected &&
            hasTemplate &&
            !selectClick.current &&
            "id" in value
          ) {
            /*
            setPath((ps) => [
              ...ps,
              {
                id: value.id,
                label: `${folder.label} (filtre)`,
                parentProp: null,
              },
            ]);
            */
          }
          selectClick.current = false;
        }}
      >
        <div className="flex w-full py-0.5">
          <div className="w-6 flex-center">
            <FolderIcon className="w-3 h-3" />
          </div>
          <div className="px-2">{folder.label}</div>
        </div>
        {/*docs.length === 0 && (
          <div className="w-full px-2 py-0.5 select-none">
            [Ingen resultater · Klik for at indstille]
          </div>
        )}
        {docs.map(({ id: docId, record }) => (
          <div key={docId} className="flex w-full py-0.5">
            <div className="w-6 flex-center">
              <DocumentIcon className="w-3 h-3" />
            </div>
            {(template ?? []).map(({ id }) => {
              const initialValue =
                record[createTemplateFieldId(docId, id)] ?? undefined;
              return (
                <ValueDisplay
                  key={`${docId}-${id}-${Boolean(initialValue)}`}
                  id={createTemplateFieldId(docId, id)}
                  initialValue={initialValue}
                  record={record}
                />
              );
            })}
          </div>
        ))*/}
      </div>
    </div>
  );
}

const type = "nested-folder";
type TokenType = NestedFolder;

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

export function $createFolderNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isFolderNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
