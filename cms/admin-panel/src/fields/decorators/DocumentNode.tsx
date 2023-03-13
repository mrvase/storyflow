import React from "react";
import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { caretClasses } from "./caret";
import {
  Computation,
  ComputationRecord,
  DocumentId,
  FieldId,
  NestedDocument,
  Value,
} from "@storyflow/backend/types";
import { useBuilderPath } from "../BuilderPath";
import {
  ChevronDownIcon,
  DocumentIcon,
  FolderArrowDownIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { useFieldId } from "../FieldIdContext";
import { useFieldConfig } from "../../documents/collab/hooks";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";
import { useArticle, useArticleList } from "../../documents";
import { useFieldTemplate } from "../default/useFieldTemplate";
import { calculateFn } from "../default/calculateFn";
import { useGlobalState } from "../../state/state";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import {
  computeFieldId,
  getRawFieldId,
  isNestedDocumentId,
} from "@storyflow/backend/ids";
import { useClient } from "../../client";
import { getPreview } from "../default/getPreview";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";

function DocumentDecorator({
  value,
  nodeKey,
}: {
  value: NestedDocument;
  nodeKey: string;
}) {
  const [, setPath] = useBuilderPath();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const id = useFieldId();
  const [config, setConfig] = useFieldConfig(id);
  const template = useFieldTemplate(id);
  const hasTemplate = Boolean(template);

  let docs: (NestedDocument & { record: ComputationRecord })[] = [];
  if (isNestedDocumentId(value.id)) {
    // TODO make reactive
    docs = [{ id: value.id, record: {} }];
  } else {
    const { article } = useArticle(value.id);
    docs = [{ id: value.id, record: article?.record ?? {} }];
  }

  const color = isNestedDocumentId(value.id)
    ? cl(
        "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
        !isSelected && "ring-1 ring-sky-200 dark:ring-sky-800",
        hasTemplate &&
          "child:divide-x child:divide-sky-200 child:dark:divide-sky-800"
      )
    : cl(
        "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
        !isSelected && "ring-1 ring-teal-200 dark:ring-teal-800",
        hasTemplate &&
          "child:divide-x child:divide-teal-200 child:dark:divide-teal-800"
      );

  const Icon = isNestedDocumentId(value.id) ? DocumentIcon : LinkIcon;

  const parentFieldId = useFieldId();

  const { record: documentRecord } = useDocumentPageContext();

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
            setPath((ps) => [
              ...ps,
              {
                id: value.id,
                label: "Dokument",
                parentProp: null,
              },
            ]);
          }
          selectClick.current = false;
        }}
      >
        {docs.length === 0 && (
          <div className="w-full px-2 py-0.5 select-none">
            [Ingen resultater · Klik for at indstille]
          </div>
        )}
        {docs.map(({ id: docId, record }) => (
          <div key={docId} className="flex w-full py-0.5">
            {!hasTemplate ? (
              <TemplateSelect
                setTemplateId={(value) => setConfig("template", value)}
              />
            ) : (
              <>
                <div className="w-6 flex-center">
                  <Icon className="w-3 h-3" />
                </div>
                {(template ?? []).map(({ id }) => {
                  const initialValue =
                    record[computeFieldId(docId, getRawFieldId(id))] ??
                    undefined;
                  return (
                    <ValueDisplay
                      key={`${docId}-${id}-${Boolean(initialValue)}`}
                      id={
                        isNestedDocumentId(value.id)
                          ? (`${parentFieldId}.${value.id}/${id.slice(
                              4
                            )}` as FieldId)
                          : computeFieldId(docId, getRawFieldId(id))
                      }
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

function ValueDisplay({
  id,
  initialValue,
  record,
}: {
  id: FieldId;
  initialValue: Computation;
  record: ComputationRecord;
}) {
  const client = useClient();

  let output: undefined | Value[];

  if (initialValue) {
    [output] = useGlobalState(id, () =>
      calculateFn(id, initialValue, { record, client })
    );
  } else {
    [output] = useGlobalState<Value[]>(id);
  }

  return (
    <div className="grow shrink basis-0 px-2 truncate">
      {getPreview(output || [])}
    </div>
  );
}

function TemplateSelect({
  setTemplateId,
}: {
  setTemplateId: (value: DocumentId) => void;
}) {
  const id = TEMPLATE_FOLDER;
  const { articles } = useArticleList(id);

  return (
    <Menu as="div" className="relative">
      {({ open }) => (
        <>
          <Menu.Button
            as="button"
            className="group h-full px-2 hover:bg-white/5 flex-center gap-1 rounded cursor-default transition-colors"
          >
            [Vælg skabelon]
            <ChevronDownIcon className="w-3 h-3 opacity-0 group-hover:opacity-75 transition-opacity" />
          </Menu.Button>
          <MenuTransition show={open} className="absolute z-10">
            <Menu.Items className="w-40 bg-white dark:bg-gray-800 mt-1 rounded shadow flex flex-col outline-none overflow-hidden">
              <Menu.Item>
                {({ active }) => (
                  <>
                    {(articles ?? []).map((el) => (
                      <button
                        key={el._id}
                        className={cl(
                          "py-1 px-2 hover:bg-white/5 outline-none text-left",
                          active && "bg-white/5"
                        )}
                        onClick={() => {
                          setTemplateId(el._id);
                        }}
                      >
                        {el._id}
                      </button>
                    ))}
                  </>
                )}
              </Menu.Item>
            </Menu.Items>
          </MenuTransition>
        </>
      )}
    </Menu>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedDocumentNode = Spread<
  {
    type: "nested-document";
    value: NestedDocument;
  },
  SerializedLexicalNode
>;

export class DocumentNode extends DecoratorNode<React.ReactNode> {
  __value: NestedDocument;

  static getType(): string {
    return "nested-document";
  }

  static clone(node: DocumentNode): DocumentNode {
    return new DocumentNode(node.__value, node.__key);
  }

  constructor(value: NestedDocument, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-nested-document", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return `&`;
  }

  static importJSON(
    serializedDocumentNode: SerializedDocumentNode
  ): DocumentNode {
    return $createDocumentNode(serializedDocumentNode.value);
  }

  exportJSON(): SerializedDocumentNode {
    const self = this.getLatest();
    return {
      type: "nested-document",
      value: self.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-nested-document", "true");
    element.textContent = `%`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-nested-document")) {
          return null as any;
        }
        return {
          conversion: convertImportElement,
          priority: 1,
        };
      },
    };
  }

  decorate(): React.ReactNode {
    return <DocumentDecorator value={this.__value} nodeKey={this.__key} />;
  }
}

export function $createDocumentNode(element: NestedDocument): DocumentNode {
  return new DocumentNode(element);
}

export function $isDocumentNode(node: LexicalNode): boolean {
  return node instanceof DocumentNode;
}
