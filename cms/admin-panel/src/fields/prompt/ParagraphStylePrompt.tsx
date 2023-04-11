import {
  $getSelection,
  $isRangeSelection,
  LexicalNode,
  $isParagraphNode,
  $createParagraphNode,
} from "lexical";
import React from "react";
import { useClientConfig } from "../../client-config";
import { useEditorContext } from "../../editor/react/EditorProvider";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "../../editor/react/HeadingNode";
import { Option } from "./Option";
import { $exitPromptNode } from "./utils";

export function ParagraphStylePrompt({ prompt }: { prompt: string }) {
  const editor = useEditorContext();

  const { libraries } = useClientConfig();

  const formatHeading = React.useCallback(
    (arg: "h1" | "h2" | "h3" | "p") => {
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
          $exitPromptNode(libraries);
        }
      });
    },
    [editor, libraries]
  );

  const options = React.useMemo(
    () =>
      [
        {
          label: "Overskrift 1",
          value: "h1",
        },
        {
          label: "Overskrift 2",
          value: "h2",
        },
        {
          label: "Overskrift 3",
          value: "h3",
        },
        {
          label: "Brødtekst",
          value: "p",
        },
      ] as const,
    []
  );

  const filtered = prompt
    ? options.filter(({ label }) =>
        label.toLowerCase().includes(prompt.toLowerCase())
      )
    : options;

  return (
    <div className="p-2.5">
      <div className="font-normal opacity-50 mb-1 ml-1">Formater afsnit</div>
      {filtered.map((option) => (
        <Option key={option.value} value={option.value} onEnter={formatHeading}>
          {option.label}
        </Option>
      ))}
    </div>
  );
}
