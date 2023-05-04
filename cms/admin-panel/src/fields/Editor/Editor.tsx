import { ContentPlugin } from "./ContentPlugin";
import { DecoratorPlugin } from "./DecoratorPlugin";
import { EditorProvider } from "../../editor/react/EditorProvider";
import React from "react";
import { $initializeEditor } from "./transforms";
import type { TokenStream } from "operations/types";
import { Reconciler } from "./reconciler/Reconciler";
import {
  EditorFocusPlugin,
  useIsFocused,
} from "../../editor/react/useIsFocused";
import { useClientConfig } from "../../client-config";
import { useFieldFocus } from "../../field-focus";
import { useFieldId } from "../FieldIdContext";
import { CopyPastePlugin } from "./CopyPastePlugin";
import { StreamOperation, TransformOperation } from "operations/actions";
import { Klass, LexicalNode } from "lexical";

const editorConfig = {
  namespace: "EDITOR",
  theme: {},
  onError: () => {},
};

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
  const { libraries } = useClientConfig();

  return (
    <EditorProvider
      nodes={nodes}
      initialConfig={editorConfig}
      initialize={() => {
        $initializeEditor(initialValue ?? [], libraries);
      }}
    >
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
