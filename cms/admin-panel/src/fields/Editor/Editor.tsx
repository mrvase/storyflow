import { ImportNode } from "../decorators/ImportNode";
import { OperatorNode } from "../decorators/OperatorNode";
import { ParameterNode } from "../decorators/ParameterNode";
import { ContentPlugin } from "./ContentPlugin";
import { DecoratorPlugin } from "./DecoratorPlugin";
import {
  EditorProvider,
  useEditorContext,
} from "../../editor/react/EditorProvider";
import { AnyOp, Target, ComputationOp } from "shared/operations";
import React from "react";
import { FunctionNode } from "../decorators/FunctionNode";
import { $getComputation, $initializeEditor } from "./transforms";
import {
  Computation,
  EditorComputation,
  FieldId,
  FunctionName,
} from "@storyflow/backend/types";
import { Reconciler } from "./Reconciler";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useClientConfig } from "../../client-config";
import { useFieldFocus } from "../../field-focus";
import { LayoutElementNode } from "../decorators/LayoutElementNode";
import { DocumentNode } from "../decorators/DocumentNode";
import { InlineLayoutElementNode } from "../decorators/InlineLayoutElementNode";
import { $getRoot } from "lexical";
import { decodeEditorComputation } from "shared/editor-computation";
import { HeadingNode } from "../../editor/react/HeadingNode";
import { Query } from "../Query";
import { TokenNode } from "../decorators/TokenNode";
import { QueueListener } from "@storyflow/state";

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
  ],
};

function FocusPlugin({ id }: { id: string }) {
  const editor = useEditorContext();
  const isFocused = useIsFocused(editor);
  const [, setFocused] = useFieldFocus();

  React.useEffect(() => {
    if (isFocused) {
      setFocused(id);
    } else {
      setFocused(null);
    }
  }, [isFocused, id]);

  return null;
}

export default function Editor({
  id,
  push,
  register,
  initialValue,
  children = null,
  target,
  setValue,
  transform,
}: {
  id: FieldId;
  target?: Target;
  push?: (
    payload:
      | ComputationOp["ops"]
      | ((prev: ComputationOp["ops"] | undefined) => ComputationOp["ops"][]),
    noTracking?: boolean
  ) => void;
  register?: (listener: QueueListener<ComputationOp>) => () => void;
  initialValue: EditorComputation;
  setValue: (value: () => Computation) => void;
  transform?: FunctionName;
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
      <ContentPlugin id={id} />
      <DecoratorPlugin />
      <FocusPlugin id={id} />
      {push && register && target ? (
        <Query push={push}>
          {(pushWithQuery) => (
            <Reconciler
              target={target}
              push={pushWithQuery}
              register={register}
              initialValue={initialValue}
              setValue={setValue}
              transform={transform}
            />
          )}
        </Query>
      ) : (
        <Setter setValue={setValue} transform={transform} />
      )}
      {children}
    </EditorProvider>
  );
}

function Setter({
  setValue,
  transform,
}: {
  setValue: (callback: () => Computation) => void;
  transform?: FunctionName;
}) {
  const editor = useEditorContext();

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements }) => {
      if (dirtyElements.size === 0) {
        return;
      }

      const next = editorState.read(() => $getComputation($getRoot()));
      setValue(() => decodeEditorComputation(next, transform));
    });
  }, [editor]);

  return null;
}
