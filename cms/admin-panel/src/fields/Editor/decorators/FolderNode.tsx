import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import {
  SyntaxTreeRecord,
  NestedDocument,
  NestedFolder,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { FolderIcon } from "@heroicons/react/24/outline";
import { useTemplate } from "../../default/useFieldTemplate";
import { useFolder } from "../../../folders/collab/hooks";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { ExtendPath, usePath, useSelectedPath } from "../../Path";
import {
  Attributes,
  AttributesProvider,
  useAttributesContext,
} from "../../Attributes";
import { useFieldTemplateId } from "../../default/FieldTemplateContext";
import { DefaultField } from "../../default/DefaultField";
import { EditorFocusProvider } from "../../../editor/react/useIsFocused";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedFolder;
  nodeKey: string;
}) {
  const [{ selectedPath }, setPath] = useSelectedPath();
  const path = usePath();

  const { isSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  let templateId = useFieldTemplateId();
  const template = useTemplate(templateId);

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
      <EditorFocusProvider>
        <div
          className={cl(
            "relative",
            "rounded",
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
          <div className="flex w-full py-1 text-sm selection:bg-transparent">
            <div className="w-11 flex-center shrink-0">
              <FolderIcon className="w-4 h-4" />
            </div>
            <div className="px-2 shrink-0">{folder.label}</div>
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
          <NestedDefaultField documentId={value.id} />
        </div>
      </EditorFocusProvider>
    </AttributesProvider>
  );
}

function NestedDefaultField({ documentId }: { documentId: NestedDocumentId }) {
  const [propId] = useAttributesContext();

  if (!propId) {
    return null;
  }

  return (
    <ExtendPath id={documentId} type="document">
      <ExtendPath id={propId} type="field">
        <div className="cursor-auto mt-1.5 pl-[2.875rem] pr-2.5">
          <DefaultField id={propId} showPromptButton />
        </div>
      </ExtendPath>
    </ExtendPath>
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
