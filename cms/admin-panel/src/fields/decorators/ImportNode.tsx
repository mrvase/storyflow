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
import cl from "clsx";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import { useLabel } from "../../state/documentConfig";
import { useGlobalState } from "../../state/state";
import { useGlobalContext } from "../../state/context";
import { useArticlePageContext } from "../../articles/ArticlePageContext";
import { getPreview } from "../default/DefaultField";
import { Computation, FieldId, FieldImport } from "@storyflow/backend/types";
import { usePathContext } from "../PathContext";

const useState = (
  id: FieldId,
  templateId?: string
): [label: string, value: Computation | undefined] => {
  if (templateId) {
    return [`Kolonne`, [`Kolonne`]];
    /*
    const [articleField] = useGlobalState<string>(id);
    const label1 = useLabel(id);
    const id2 = `${articleField}${templateId}`;
    const [value] = useGlobalState<Computation>(id2);
    const label2 = useLabel(`${templateId.slice(0, 4)}${templateId}`);
    return [`${label1} · ${label2}`, value];
    */
  } else {
    let value: Computation | undefined;
    let label: string = "";
    if (!id) return [label, value];
    if (id.startsWith("ctx:")) {
      const { id } = useArticlePageContext();
      value = useGlobalContext(id, id.slice(4))[0][id.slice(4)];
      label = id.slice(4);
    } else {
      value = useGlobalState<Computation>(id)[0];
      label = useLabel(id);
    }
    return [label, value];
  }
};

function ImportDecorator({
  nodeKey,
  fieldImport,
}: {
  text: string;
  nodeKey: string;
  fieldImport: FieldImport;
}) {
  const { goToPath } = usePathContext();

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);

  const parameters = ["x", "y", "z"];

  const [label, value] = useState(fieldImport.fref, fieldImport.pick);

  const preview = getPreview(value ?? []);

  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "bg-gray-50 dark:bg-teal-400/20 text-teal-100/90 rounded-sm selection:bg-transparent relative",
        // "after:absolute after:w-full after:left-0 after:-bottom-0.5 after:border-b-2 after:border-b-white/20",
        isSelected ? "ring-2 ring-amber-300" : "dark:ring-gray-600",
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
          goToPath({
            id: fieldImport.id,
            label: fieldImport.id,
            parentProp: null,
          });
        }
        selectClick.current = false;
      }}
    >
      {isSelected && (
        <span
          className={cl(
            "relative text-gray-600 dark:text-gray-500 truncate text-sm",
            preview && "mx-2"
          )}
        >
          {label || "Ingen label"}
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
        <span>{preview || "Intet indhold"}</span>
      )}
    </span>
  );
}

function convertImportElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  return null;
}

export type SerializedImportNode = Spread<
  {
    type: "import";
    value: FieldImport;
  },
  SerializedLexicalNode
>;

export class ImportNode extends DecoratorNode<React.ReactNode> {
  __value: FieldImport;

  static getType(): string {
    return "import";
  }

  static clone(node: ImportNode): ImportNode {
    return new ImportNode(node.__value, node.__key);
  }

  constructor(fieldImport: FieldImport, key?: NodeKey) {
    super(key);
    this.__value = fieldImport;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-import", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return "x";
  }

  static importJSON(serializedImportNode: SerializedImportNode): ImportNode {
    return $createImportNode(serializedImportNode.value);
  }

  exportJSON(): SerializedImportNode {
    return {
      type: "import",
      value: this.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-import", "true");
    element.textContent = "x";
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-import")) {
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
    return (
      <ImportDecorator
        text={this.__text}
        nodeKey={this.__key}
        fieldImport={this.__value}
      />
    );
  }
}

export function $createImportNode(fieldImport: FieldImport): ImportNode {
  return new ImportNode(fieldImport);
}

export function $isImportNode(node: LexicalNode): boolean {
  return node instanceof ImportNode;
}
