import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { CalculatorIcon, PaintBrushIcon } from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  LexicalNode,
} from "lexical";
import { useIsFocused as useEditorIsFocused } from "../../editor/react/useIsFocused";
import { $isDocumentNode } from "../decorators/DocumentNode";
import { useMathMode } from "../Editor/useMathMode";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "../../editor/react/HeadingNode";
import { Menu } from "./Menu";
import { useFieldConfig } from "../../documents/collab/hooks";
import { useFieldId } from "../FieldIdContext";
import {
  $getComputation,
  $getIndexesFromSelection,
} from "../Editor/transforms";
import { tools } from "shared/editor-tools";
import { $createPromptNode } from "../decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";

export function Plus() {
  const editor = useEditorContext();

  const id = useFieldId();
  const [config] = useFieldConfig(id);

  const [mathMode, setMathMode] = useMathMode(config?.restrictTo === "number");

  const isFocused = useEditorIsFocused();

  const offset = 0;

  const [y, setY] = React.useState<number | null>(null);

  const normalize = (value: number) => value;

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        let node: LexicalNode;
        if ($isRangeSelection(selection)) {
          node = selection.anchor.getNode();
        } else if ($isNodeSelection(selection)) {
          node = selection.getNodes()[0];
        } else {
          return;
        }
        while (node && ($isTextNode(node) || node.isInline())) {
          node = node.getParent()!;
        }
        const getY = (el: HTMLElement | null) =>
          el?.getBoundingClientRect()?.y ?? 0;
        const root = getY(editor.getRootElement());
        const element = editor.getElementByKey(node.__key);
        const y = getY(element);
        setY(normalize(offset + y - root));
      });
    });
  }, [editor]);

  const formatHeading = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        let node: LexicalNode = selection.anchor.getNode();
        if (selection.anchor.type === "text") {
          node = node.getParent() as LexicalNode;
          node = (node.isInline() ? node.getParent() : node) as LexicalNode;
        }
        let targetElement: LexicalNode | null = null;
        if ($isParagraphNode(node)) {
          targetElement = $createHeadingNode("h1");
        }
        if ($isHeadingNode(node)) {
          const tag = node.__tag;
          const level = parseInt(tag.slice(1), 10);
          if (level < 2) {
            targetElement = $createHeadingNode(`h${(level + 1) as 2 | 3}`);
          } else {
            targetElement = $createParagraphNode();
          }
        }
        if (targetElement) {
          targetElement.setFormat(node.getFormatType());
          targetElement.setIndent(node.getIndent());
          node.replace(targetElement, true);
        }
      }
    });
  };

  const Icon = PaintBrushIcon; // mathMode ? CalculatorIcon : PaintBrushIcon;

  return isFocused && y !== null ? (
    <>
      <div
        className="absolute top-0 -left-[2.875rem] w-4 h-4 m-1 mx-2.5 opacity-50 hover:opacity-100"
        style={{ transform: `translateY(${y}px)` }}
        onMouseDown={(ev) => {
          ev.preventDefault();
          /*
          if (config?.restrictTo !== "number") {
            formatHeading();
          }
          */
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
              return;
            }
            const [start, end] = $getIndexesFromSelection(selection);
            const streamFull = $getComputation($getRoot());
            const stream = tools.slice(streamFull, start, end);

            const paragraph = $createParagraphNode();
            const prompt = $createPromptNode("/", "\uFEFF\uFEFF", stream);
            paragraph.append(prompt);

            if ($isNodeSelection(selection)) {
              const node = selection.getNodes()[0];
              node.replace(paragraph);
            } else {
              $replaceWithBlocks(editor, [paragraph]);
            }
            prompt.select(2, 2);
          });
        }}
      >
        <Icon className="w-4 h-4" />
      </div>
    </>
  ) : null;
}
