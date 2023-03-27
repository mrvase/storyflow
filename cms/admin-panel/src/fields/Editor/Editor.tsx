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
import { DocumentNode } from "../decorators/DocumentNode";
import { ContextNode } from "../decorators/ContextNode";
import { FolderNode } from "../decorators/FolderNode";
import { ImportNode } from "../decorators/ImportNode";
import { OperatorNode } from "../decorators/OperatorNode";
import { ParameterNode } from "../decorators/ParameterNode";
import { FunctionNode } from "../decorators/FunctionNode";
import { TokenNode } from "../decorators/TokenNode";
import { LayoutElementNode } from "../decorators/LayoutElementNode";
import { InlineLayoutElementNode } from "../decorators/InlineLayoutElementNode";
import { CreatorNode } from "../decorators/CreatorNode";

const editorConfig = {
  namespace: "EDITOR",
  theme: {},
  onError: () => {},
  nodes: [
    ImportNode,
    OperatorNode,
    ParameterNode,
    FunctionNode,
    LayoutElementNode,
    InlineLayoutElementNode,
    DocumentNode,
    HeadingNode,
    TokenNode,
    ContextNode,
    FolderNode,
    CreatorNode,
  ],
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
      {/*<CopyPastePlugin />*/}
      <DecoratorPlugin />
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
      {children}
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
