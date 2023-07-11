import { ContentPlugin } from "./ContentPlugin";
import { DecoratorPlugin } from "./DecoratorPlugin";
import {
  EditorProvider,
  useEditorContext,
} from "../../editor/react/EditorProvider";
import React from "react";
import { $initializeEditor } from "./transforms";
import type { TokenStream } from "../../operations/types";
import { Reconciler } from "./reconciler/Reconciler";
import {
  EditorFocusPlugin,
  useIsFocused,
} from "../../editor/react/useIsFocused";
import { useAppConfig } from "../../AppConfigContext";
import { useFieldFocus } from "../../FieldFocusContext";
import { useFieldId } from "../FieldIdContext";
import { CopyPastePlugin } from "./CopyPastePlugin";
import { StreamOperation, TransformOperation } from "../../operations/actions";
import {
  $getRoot,
  $isParagraphNode,
  $setSelection,
  Klass,
  LexicalNode,
} from "lexical";
import $createRangeSelection from "../../editor/createRangeSelection";
import BlockNode from "./decorators/BlockNode";
import { getFunctionName } from "@storyflow/cms/symbols";
import { SIGNATURES } from "@storyflow/cms/constants";

const editorConfig = {
  namespace: "EDITOR",
  theme: {
    text: {
      bold: "font-bold",
      italic: "italic",
    },
  },
  onError: () => {},
};

function BlockNodePlugin() {
  const editor = useEditorContext();

  React.useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const listener = (ev: MouseEvent) => {
      const target = ev.target;
      if (!target || !(target instanceof HTMLElement)) return;
      if (!target.classList.contains("block-node")) return;
      ev.preventDefault();
      ev.stopPropagation();
      editor.update(() => {
        let key: string | null = null;
        editor._keyToDOMMap.forEach((value, nodeKey) => {
          if (value === target) {
            key = nodeKey;
          }
        });
        if (!key) return;
        const node = editor.getEditorState()._nodeMap.get(key);
        if (!node) return;
        const parent = node.getParent();
        const offset = node.getIndexWithinParent();
        if (!parent || offset < 0) return;
        const selection = $createRangeSelection(
          {
            node: parent,
            offset,
            type: "element",
          },
          {
            node: parent,
            offset,
            type: "element",
          }
        );
        editor.getRootElement()?.focus();
        $setSelection(selection);
      });
    };

    root.addEventListener("mousedown", listener);
    return () => {
      root.removeEventListener("mousedown", listener);
    };
  }, [editor]);

  React.useEffect(() => {
    return editor.registerNodeTransform(BlockNode, (node) => {
      const name = getFunctionName(node.__func);
      const paramsLength = SIGNATURES[name].length;
      const size = node.getChildrenSize();
      if (size > paramsLength) {
        const children = node.getChildren().slice(paramsLength, size);
        children.reverse().forEach((child) => {
          child.remove();
          node.insertAfter(child);
        });
        // select last child
        if ($isParagraphNode(children[0])) {
          children[0].select(0, 0);
        }
      }
    });
  }, []);

  return null;
}

export default function Editor({
  nodes,
  push,
  tracker,
  initialValue,
  children = null,
  target,
}: {
  nodes: ReadonlyArray<Klass<LexicalNode>>;
  target?: string;
  push?: (ops: StreamOperation[] | TransformOperation[]) => void;
  tracker?: object;
  initialValue: TokenStream;
  children?: React.ReactNode;
}) {
  const { configs } = useAppConfig();

  return (
    <EditorProvider
      nodes={nodes}
      initialConfig={editorConfig}
      initialize={() => {
        $initializeEditor(initialValue ?? [], configs);
      }}
    >
      <BlockNodePlugin />
      <ContentPlugin />
      <CopyPastePlugin />
      <EditorFocusPlugin />
      <FieldFocusPlugin />
      {push && typeof target === "string" && (
        <Reconciler
          target={target}
          push={push}
          tracker={tracker}
          initialValue={initialValue}
        />
      )}
      {children}
      <DecoratorPlugin />
      {/*
      putting DecoratorPlugin after ContentEditable fixes flushSync error.
      Caused by flushSync being triggered on editorState initialization in React.useMemo
      */}
    </EditorProvider>
  );
}

function FieldFocusPlugin() {
  const id = useFieldId();
  const isFocused = useIsFocused();
  const [, setFocused] = useFieldFocus();

  const prevIsFocused = React.useRef(false);

  React.useEffect(() => {
    if (isFocused) {
      setFocused(id);
      prevIsFocused.current = true;
    } else if (prevIsFocused.current) {
      setFocused(null);
      prevIsFocused.current = false;
    }
  }, [isFocused, id]);

  return null;
}

/*
function Setter({
  setValue,
}: {
  setValue: (callback: () => TokenStream) => void;
}) {
  const editor = useEditorContext();

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements }) => {
      if (dirtyElements.size === 0) {
        return;
      }

      const next = editorState.read(() => $getComputation($getRoot()));
      setValue(() => next);
    });
  }, [editor]);

  return null;
}
*/
