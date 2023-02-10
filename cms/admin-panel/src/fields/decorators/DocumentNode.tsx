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
  DocumentImport,
  Fetcher,
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
import { useFieldConfig } from "../../state/documentConfig";
import { Menu } from "@headlessui/react";
import { MenuTransition } from "../../elements/transitions/MenuTransition";
import { useTemplateFolder } from "../../folders";
import { useArticle, useArticleList } from "../../articles";
import { useFieldTemplate } from "../default/useFieldTemplate";
import { calculateFn } from "../default/calculateFn";
import { useGlobalState } from "../../state/state";
import { useArticlePageContext } from "../../articles/ArticlePageContext";
import { computeFieldId, getTemplateFieldId } from "@storyflow/backend/ids";
import { useClient } from "../../client";
import { getComputationRecord } from "@storyflow/backend/flatten";
import { getPreview } from "../default/getPreview";

function DocumentDecorator({
  value,
  nodeKey,
}: {
  value: NestedDocument | DocumentImport | Fetcher;
  nodeKey: string;
}) {
  const [, setPath] = useBuilderPath();

  const type = (() => {
    if ("dref" in value) {
      return "import";
    }
    if ("values" in value) {
      return "nested";
    }
    return "fetcher";
  })();

  const Icon = {
    import: LinkIcon,
    fetcher: FolderArrowDownIcon,
    nested: DocumentIcon,
  }[type];

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const selectClick = React.useRef(false);

  const id = useFieldId();
  const [config, setConfig] = useFieldConfig(id);
  const template = useFieldTemplate(id);
  const hasTemplate = Boolean(template);

  let docs: NestedDocument[] = [];
  if ("filters" in value) {
    const [output] = useGlobalState<NestedDocument[]>(`${id}.${value.id}`);
    docs = output ?? [];
  } else if ("values" in value) {
    docs = [value];
  } else if ("dref" in value) {
    const { article } = useArticle(value.dref);
    let values = article ? getComputationRecord(article) : {};
    values = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        getTemplateFieldId(key as FieldId),
        value,
      ])
    );
    docs = [{ id: value.dref, values }];
  }

  const color = {
    import: cl(
      "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      !isSelected && "ring-1 ring-teal-200 dark:ring-teal-800",
      hasTemplate &&
        "child:divide-x child:divide-teal-200 child:dark:divide-teal-800"
    ),
    fetcher: cl(
      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      !isSelected && "ring-1 ring-red-200 dark:ring-red-800",
      hasTemplate &&
        "divide-y divide-red-200 dark:divide-red-800 child:divide-x child:divide-red-200 child:dark:divide-red-800"
    ),
    nested: cl(
      "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
      !isSelected && "ring-1 ring-sky-200 dark:ring-sky-800",
      hasTemplate &&
        "child:divide-x child:divide-sky-200 child:dark:divide-sky-800"
    ),
  }[type];

  const parentFieldId = useFieldId();

  const { imports } = useArticlePageContext();

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
                label: type === "fetcher" ? "Fetcher" : "Dokument",
                parentProp: null,
              },
            ]);
          }
          selectClick.current = false;
        }}
      >
        {docs.length === 0 && <div className="text-center w-full">[TOM]</div>}
        {docs.map(({ id: docId, values }) => (
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
                    values[getTemplateFieldId(id)] ?? undefined;
                  return (
                    <ValueDisplay
                      key={`${docId}-${id}-${Boolean(initialValue)}`}
                      id={
                        type === "nested" && "id" in value
                          ? (`${parentFieldId}.${value.id}/${id.slice(
                              4
                            )}` as FieldId)
                          : computeFieldId(docId, getTemplateFieldId(id))
                      }
                      initialValue={initialValue}
                      imports={type == "nested" ? imports : values}
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
  imports,
}: {
  id: FieldId;
  initialValue: Computation;
  imports: ComputationRecord;
}) {
  const client = useClient();

  let output: undefined | Value[];

  if (initialValue) {
    [output] = useGlobalState(id, () =>
      calculateFn(id, initialValue, { imports, client })
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
  const id = useTemplateFolder()?.id;
  const { articles } = useArticleList(id);

  return (
    <Menu as="div" className="relative">
      {({ open }) => (
        <>
          <Menu.Button
            as="button"
            className="group h-full px-2 hover:bg-white/5 flex-center gap-1 rounded cursor-default transition-colors"
          >
            Vælg skabelon
            <ChevronDownIcon className="w-3 h-3 opacity-0 group-hover:opacity-75 transition-opacity" />
          </Menu.Button>
          <MenuTransition show={open} className="absolute z-10">
            <Menu.Items className="w-40 bg-white dark:bg-gray-800 mt-1 rounded shadow flex flex-col outline-none overflow-hidden">
              <Menu.Item>
                {({ active }) => (
                  <>
                    {(articles ?? []).map((el) => (
                      <button
                        key={el.id}
                        className={cl(
                          "py-1 px-2 hover:bg-white/5 outline-none text-left",
                          active && "bg-white/5"
                        )}
                        onClick={() => {
                          setTemplateId(el.id);
                        }}
                      >
                        {el.id}
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
    value: NestedDocument | DocumentImport | Fetcher;
  },
  SerializedLexicalNode
>;

export class DocumentNode extends DecoratorNode<React.ReactNode> {
  __value: NestedDocument | DocumentImport | Fetcher;

  static getType(): string {
    return "nested-document";
  }

  static clone(node: DocumentNode): DocumentNode {
    return new DocumentNode(node.__value, node.__key);
  }

  constructor(value: NestedDocument | DocumentImport | Fetcher, key?: NodeKey) {
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

export function $createDocumentNode(
  element: NestedDocument | DocumentImport | Fetcher
): DocumentNode {
  return new DocumentNode(element);
}

export function $isDocumentNode(node: LexicalNode): boolean {
  return node instanceof DocumentNode;
}
