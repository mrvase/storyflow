import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import {
  SyntaxTree,
  SyntaxTreeRecord,
  NestedDocument,
  ValueArray,
  ClientSyntaxTree,
  FieldId,
} from "@storyflow/backend/types";
import { DocumentIcon, LinkIcon } from "@heroicons/react/24/outline";
import { useFieldId } from "../../FieldIdContext";
import { useDocument } from "../../../documents";
import { calculateFn } from "../../default/calculateFn";
import { useGlobalState } from "../../../state/state";
import { useDocumentPageContext } from "../../../documents/DocumentPageContext";
import {
  createTemplateFieldId,
  getDocumentId,
  isNestedDocumentId,
} from "@storyflow/backend/ids";
import { useClient } from "../../../client";
import { getPreview } from "../../default/getPreview";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import { useFieldTemplateId } from "../../default/FieldTemplateContext";
import { useTemplate } from "../../default/useFieldTemplate";

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedDocument;
  nodeKey: string;
}) {
  // const [, setPath] = useBuilderPath();

  const { isSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const id = useFieldId();

  let templateId = useFieldTemplateId();
  const template = useTemplate(templateId);

  const hasTemplate = Boolean(template);

  let docs: (NestedDocument & { record: SyntaxTreeRecord })[] = [];
  if (isNestedDocumentId(value.id)) {
    // TODO make reactive
    docs = [{ id: value.id, record: {} }];
  } else {
    const { doc } = useDocument(value.id);
    docs = [{ id: value.id, record: doc?.record ?? {} }];
  }

  const color = isNestedDocumentId(value.id)
    ? cl(
        "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
        !isSelected && "ring-1 ring-sky-200 dark:ring-sky-800",
        hasTemplate &&
          "child:divide-x child:divide-sky-200 child:dark:divide-sky-800"
      )
    : cl(
        "bg-gradient-to-b from-teal-800/90 to-teal-900/90 text-teal-200",
        !isSelected && "ring-1 ring-teal-200 dark:ring-teal-800",
        hasTemplate &&
          "child:divide-x child:divide-teal-200 child:dark:divide-teal-800"
      );

  const Icon = isNestedDocumentId(value.id) ? DocumentIcon : LinkIcon;

  const { record: documentRecord } = useDocumentPageContext();

  return (
    <div className="">
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
            /*
            setPath((ps) => [
              ...ps,
              {
                id: value.id,
                label: "Dokument",
                parentProp: null,
              },
            ]);
            */
          }
          selectClick.current = false;
        }}
      >
        {docs.length === 0 && (
          <div className="w-full px-2 py-1.5 select-none">
            [Ingen resultater · Klik for at indstille]
          </div>
        )}
        {docs.map(({ id: docId, record }) => (
          <div key={docId} className="flex w-full py-1">
            {!hasTemplate ? (
              <>Ingen skabelon valgt</>
            ) : (
              <>
                <div className="w-8 flex-center">
                  <Icon className="w-4 h-4" />
                </div>
                {(template ?? []).map(({ id }) => {
                  const initialValue =
                    record[createTemplateFieldId(docId, id)] ?? undefined;
                  return (
                    <ValueDisplay
                      key={`${docId}-${id}-${Boolean(initialValue)}`}
                      id={createTemplateFieldId(docId, id)}
                      initialValue={initialValue}
                      record={
                        isNestedDocumentId(value.id) ? documentRecord : record
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ValueDisplay({
  id,
  initialValue,
  record,
}: {
  id: FieldId;
  initialValue: SyntaxTree;
  record: SyntaxTreeRecord;
}) {
  const client = useClient();

  let output: undefined | ValueArray | ClientSyntaxTree;

  if (initialValue) {
    [output] = useGlobalState(id, () =>
      calculateFn(initialValue, {
        record,
        client,
        documentId: getDocumentId(id),
      })
    );
  } else {
    [output] = useGlobalState<ValueArray>(id);
  }

  return (
    <div className="grow shrink basis-0 px-2 truncate">
      {getPreview(output || [])}
    </div>
  );
}

const type = "nested-document";
type TokenType = NestedDocument;

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

export function $createDocumentNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isDocumentNode(node: LexicalNode): boolean {
  return node instanceof ChildNode;
}
