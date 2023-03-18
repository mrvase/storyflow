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
  SyntaxTreeRecord,
  NestedDocument,
  NestedFolder,
} from "@storyflow/backend/types";
import { useBuilderPath } from "../BuilderPath";
import { FolderIcon } from "@heroicons/react/24/outline";
import { useFieldId } from "../FieldIdContext";
import { useFieldTemplate } from "../default/useFieldTemplate";
import { useFolder } from "../../folders/collab/hooks";

function FolderDecorator({
  value,
  nodeKey,
}: {
  value: NestedFolder;
  nodeKey: string;
}) {
  const [, setPath] = useBuilderPath();

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
            setPath((ps) => [
              ...ps,
              {
                id: value.id,
                label: `${folder.label} (filtre)`,
                parentProp: null,
              },
            ]);
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

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedFolderNode = Spread<
  {
    type: "nested-folder";
    value: NestedFolder;
  },
  SerializedLexicalNode
>;

export class FolderNode extends DecoratorNode<React.ReactNode> {
  __value: NestedFolder;

  static getType(): string {
    return "nested-folder";
  }

  static clone(node: FolderNode): FolderNode {
    return new FolderNode(node.__value, node.__key);
  }

  constructor(value: NestedFolder, key?: NodeKey) {
    super(key);
    this.__value = value;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-nested-folder", "true");
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

  static importJSON(serializedFolderNode: SerializedFolderNode): FolderNode {
    return $createFolderNode(serializedFolderNode.value);
  }

  exportJSON(): SerializedFolderNode {
    const self = this.getLatest();
    return {
      type: "nested-folder",
      value: self.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-nested-folder", "true");
    element.textContent = `%`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-nested-folder")) {
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
    return <FolderDecorator value={this.__value} nodeKey={this.__key} />;
  }
}

export function $createFolderNode(element: NestedFolder): FolderNode {
  return new FolderNode(element);
}

export function $isFolderNode(node: LexicalNode): boolean {
  return node instanceof FolderNode;
}
