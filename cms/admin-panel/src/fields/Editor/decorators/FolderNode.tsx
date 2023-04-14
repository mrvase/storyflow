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
import { useFieldId } from "../../FieldIdContext";
import { useFieldTemplate } from "../../default/useFieldTemplate";
import { useFolder } from "../../../folders/collab/hooks";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { usePath, useSelectedPath } from "../../Path";
import { Attributes, AttributesProvider } from "../../Attributes";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedFolder;
  nodeKey: string;
}) {
  const [{ selectedPath }, setPath] = useSelectedPath();
  const path = usePath();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const id = useFieldId();
  const template = useFieldTemplate(id);
  const hasTemplate = Boolean(template);

  const color = cl(
    "bg-gradient-to-b from-pink-800/90 to-pink-900/90 text-pink-200",
    !isSelected && "ring-1 ring-pink-200 dark:ring-pink-800",
    hasTemplate &&
      "child:divide-x child:divide-pink-200 child:dark:divide-pink-800"
  );

  let docs: (NestedDocument & { record: SyntaxTreeRecord })[] = [];

  const folder = useFolder(value.folder);

  return (
    <AttributesProvider>
      <div
        className={cl(
          "relative",
          "rounded text-sm selection:bg-transparent",
          isSelected && "ring-1 ring-white",
          color
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
            setPath(() => [...selectedPath, ...path, value.id]);
          }
          selectClick.current = false;
        }}
      >
        <div className="flex w-full py-1">
          <div className="w-8 flex-center">
            <FolderIcon className="w-4 h-4" />
          </div>
          <div className="px-2 ">{folder.label}</div>
          <div className="pl-2">
            <Attributes entity={value} hideAsDefault color="red" />
          </div>
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
    </AttributesProvider>
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
