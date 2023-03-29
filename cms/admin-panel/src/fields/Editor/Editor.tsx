import { ContentPlugin } from "./ContentPlugin";
import { DecoratorPlugin } from "./DecoratorPlugin";
import {
  EditorProvider,
  useEditorContext,
} from "../../editor/react/EditorProvider";
import { Target, ComputationOp } from "shared/operations";
import React from "react";
import { $getComputation, $initializeEditor } from "./transforms";
import { TokenStream } from "@storyflow/backend/types";
import { Reconciler } from "./Reconciler";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useClientConfig } from "../../client-config";
import { useFieldFocus } from "../../field-focus";
import { $getRoot } from "lexical";
import { Query } from "../query/Query";
import { type QueueListener } from "@storyflow/state";
import { useFieldId } from "../FieldIdContext";

import { HeadingNode } from "../../editor/react/HeadingNode";
import nodes from "../decorators/nodes";
import { CopyPastePlugin } from "./CopyPastePlugin";
import { Prompt } from "./Prompt";

const editorConfig = {
  namespace: "EDITOR",
  theme: {},
  onError: () => {},
  nodes: [HeadingNode, ...nodes],
};

export default function Editor({
  push,
  register,
  initialValue,
  children = null,
  target,
  setValue,
}: {
  target?: Target;
  push?: (
    payload:
      | ComputationOp["ops"]
      | ((
          prev: ComputationOp["ops"] | undefined,
          noop: ComputationOp["ops"]
        ) => ComputationOp["ops"][])
  ) => void;
  register?: (listener: QueueListener<ComputationOp>) => () => void;
  initialValue: TokenStream;
  setValue: (value: () => TokenStream) => void;
  children?: React.ReactNode;
}) {
  const { libraries } = useClientConfig();

  return (
    <EditorProvider
      initialConfig={editorConfig}
      initialize={() => {
        $initializeEditor(initialValue ?? [], libraries);
      }}
    >
      <ContentPlugin />
      <CopyPastePlugin />
      <FocusPlugin />
      {push && register && target ? (
        <Query push={push}>
          {(pushWithQuery) => (
            <Reconciler
              target={target}
              push={pushWithQuery}
              register={register}
              initialValue={initialValue}
              setValue={setValue}
            />
          )}
        </Query>
      ) : (
        <Setter setValue={setValue} />
      )}
      <Prompt />
      {children}
      <DecoratorPlugin />
      {/*
      putting DecoratorPlugin after ContentEditable fixes flushSync error.
      Caused by flushSync being triggered on editorState initialization in React.useMemo
      */}
    </EditorProvider>
  );
}

function FocusPlugin() {
  const id = useFieldId();
  const editor = useEditorContext();
  const isFocused = useIsFocused(editor);
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
