import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { PaintBrushIcon } from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
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

export function Plus() {
  const editor = useEditorContext();

  const [mathMode, setMathMode] = useMathMode({});

  const read = (func: () => any) => editor.getEditorState().read(func);
  const isEditorEmpty = () => {
    return !editor.isComposing() && $getRoot().getTextContent() === "";
  };
  const hasEditorDocument = () => {
    return $getRoot()
      .getChildren()
      .some((el) => $isDocumentNode(el));
  };
  const isBlockFocused = () => {
    return !$isRangeSelection($getSelection());
  };

  const isFocused = useEditorIsFocused(editor);

  const offset = 4;

  const [y, setY] = React.useState<number | null>(null);

  const [isEmpty, setIsEmpty] = React.useState(() =>
    read(() => isEditorEmpty())
  );
  const [hasDocument, setHasDocument] = React.useState(() =>
    read(() => hasEditorDocument())
  );
  const [blockIsFocused, setBlockIsFocused] = React.useState(() =>
    read(() => isBlockFocused())
  );

  const normalize = (value: number) => value - ((value - 4) % 24);

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsEmpty(isEditorEmpty());
        setHasDocument(hasEditorDocument());
        setBlockIsFocused(isBlockFocused());
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const root = editor.getRootElement()?.getBoundingClientRect()?.y ?? 0;
          const y =
            editor
              .getElementByKey(selection.anchor.key)
              ?.getBoundingClientRect()?.y ?? 0;
          setY(normalize(offset + y - root));
        } else if ($isNodeSelection(selection)) {
          const root = editor.getRootElement()?.getBoundingClientRect()?.y ?? 0;
          const key = selection.getNodes()[0].__key;
          const y =
            editor.getElementByKey(key)?.getBoundingClientRect()?.y ?? 0;
          setY(normalize(offset + y - root));
        }
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
        const isP = $isParagraphNode(node);
        const isH = $isHeadingNode(node);
        if (isP || isH) {
          const targetElement = isP
            ? $createHeadingNode("h1")
            : $createParagraphNode();
          targetElement.setFormat(node.getFormatType());
          targetElement.setIndent(node.getIndent());
          node.replace(targetElement, true);
        }
      }
    });
  };

  return isFocused && y !== null ? (
    <>
      <div
        className="absolute top-0 left-0 w-4 h-4 m-1 mx-5 opacity-50 hover:opacity-100"
        style={{ transform: `translateY(${y}px)` }}
        onMouseDown={(ev) => {
          ev.preventDefault();
          formatHeading();
        }}
      >
        <PaintBrushIcon className="w-4 h-4" />
      </div>
      <Menu
        isEmpty={isEmpty}
        hasDocument={hasDocument}
        blockIsFocused={blockIsFocused}
        y={y}
        mathMode={mathMode}
        setMathMode={setMathMode}
      />
    </>
  ) : null;
}
