import {
  $getSelection,
  $isRangeSelection,
  LexicalNode,
  $isParagraphNode,
  $createParagraphNode,
} from "lexical";
import { useEditorContext } from "../../editor/react/EditorProvider";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "../../editor/react/HeadingNode";
import { Option } from "./Option";

export function ParagraphStylePrompt() {
  const editor = useEditorContext();

  const formatHeading = (arg: "h1" | "h2" | "h3" | "p") => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        let node: LexicalNode = selection.anchor.getNode();
        if (selection.anchor.type === "text") {
          node = node.getParent() as LexicalNode;
          node = (node.isInline() ? node.getParent() : node) as LexicalNode;
        }
        let targetElement: LexicalNode | null = null;
        if ($isHeadingNode(node) && arg === "p") {
          targetElement = $createParagraphNode();
        } else if (
          ($isParagraphNode(node) || $isHeadingNode(node)) &&
          arg !== "p"
        ) {
          targetElement = $createHeadingNode(arg);
        }
        if (targetElement) {
          targetElement.setFormat(node.getFormatType());
          targetElement.setIndent(node.getIndent());
          node.replace(targetElement, true);
        }
      }
    });
  };

  return (
    <div className="p-2.5">
      <div className="font-normal opacity-50 mb-1 ml-1">Formater afsnit</div>
      <Option value={null} onEnter={() => formatHeading("h1")}>
        Overskrift 1
      </Option>
      <Option value={null} onEnter={() => formatHeading("h2")}>
        Overskrift 2
      </Option>
      <Option value={null} onEnter={() => formatHeading("h3")}>
        Overskrift 3
      </Option>
      <Option value={null} onEnter={() => formatHeading("p")}>
        Brødtekst
      </Option>
    </div>
  );
}
