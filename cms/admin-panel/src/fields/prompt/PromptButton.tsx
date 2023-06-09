import React from "react";
import cl from "clsx";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { PaintBrushIcon } from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  LexicalNode,
} from "lexical";
import { useIsFocused as useEditorIsFocused } from "../../editor/react/useIsFocused";
import {
  $getComputation,
  $getIndexesFromSelection,
} from "../Editor/transforms";
import { tools } from "../../operations/stream-methods";
import { $createPromptNode } from "../Editor/decorators/PromptNode";
import { $replaceWithBlocks } from "../Editor/insertComputation";
import { $exitPromptNode, $getPromptNode } from "./utils";
import { useAppConfig } from "../../AppConfigContext";
import { useIsEmpty } from "../../editor/react/useIsEmpty";

export function PromptButton() {
  const editor = useEditorContext();

  const isFocused = useEditorIsFocused();

  const offset = 0;

  const [y, setY] = React.useState<number | null>(0);

  const normalize = (value: number) => value;

  const { configs } = useAppConfig();

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
  }, [editor, configs]);

  const Icon = PaintBrushIcon; // mathMode ? CalculatorIcon : PaintBrushIcon;

  const isEmpty = useIsEmpty(editor);

  return isFocused || isEmpty ? (
    <>
      <div
        className={cl(
          "absolute top-0 -left-[2.375rem] w-8 h-8 p-2 -m-1 mx-1 hover:opacity-100",
          isEmpty && !isFocused ? "opacity-25" : "opacity-50"
        )}
        style={{ transform: `translateY(${y}px)` }}
        onMouseDown={(ev) => {
          ev.preventDefault();
          /*
          if (config?.restrictTo !== "number") {
            formatHeading();
          }
          */
          editor.update(() => {
            if (!isFocused) {
              editor.getRootElement()?.focus();
              $getRoot().selectEnd();
            }
            if ($getPromptNode()) {
              $exitPromptNode(configs);
              return;
            }

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
              $replaceWithBlocks([paragraph]);
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
